-- Phase 0 (siehe Architektur-Plan "Migration: von reinen Realtime-Broadcasts
-- zu persistiertem Raum-/Fortschritts-Zustand"): Grundschema für persistierte
-- Räume + Kahoot-artige Code-Vergabe. Reine DB-Vorbereitung, noch OHNE
-- Anbindung im App-Code (folgt in Phase 1).
--
-- Sicherheitsmodell: kein Login, der 4-stellige Raum-Code ist öffentlich
-- sichtbar (Beamer/QR) und daher NICHT die Zugriffsgrenze. Die eigentliche
-- Grenze ist das serverseitig erzeugte access_token je Raum. Direkter
-- Tabellenzugriff (PostgREST/`supabase.from(...)`) ist über RLS komplett
-- gesperrt (deny-by-default) -- jeglicher Zugriff läuft ausschließlich über
-- die SECURITY DEFINER-Funktionen unten, die den Token explizit prüfen und
-- dadurch RLS bewusst umgehen (Standard-Postgres-Verhalten für den
-- Funktions-Owner). Wer künftig eine neue Tabellen-Query direkt im
-- Frontend ergänzt, bekommt also standardmäßig nichts zurück, bis er
-- bewusst eine neue geprüfte RPC-Funktion dafür anlegt.

create extension if not exists pgcrypto;

create table rooms (
  id                uuid primary key default gen_random_uuid(),
  code              text not null,
  access_token      text not null default encode(gen_random_bytes(16), 'hex'),
  status            text not null default 'lobby' check (status in ('lobby', 'live', 'ended')),
  session_id        text,
  config            jsonb not null default '{}'::jsonb,
  station_mode      boolean not null default false,
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  ended_at          timestamptz,
  last_activity_at  timestamptz not null default now()
);

-- Kahoot-Prinzip: Code ist nur unter AKTIVEN (nicht beendeten) Räumen
-- eindeutig, nicht im gesamten historischen Bestand. Ein beendeter Raum
-- gibt seinen Code sofort wieder frei.
create unique index rooms_active_code_uidx on rooms (code) where status <> 'ended';
create index rooms_status_activity_idx on rooms (status, last_activity_at);

create table room_students (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references rooms(id) on delete cascade,
  session_id      text not null,
  -- Tiername im Direkt-/Battle-/Übungsmodus, "station-<n>" im Stationsmodus.
  student_key     text not null,
  station_number  int,
  current_index   int not null default 0,
  peeks           int not null default 0,
  attempts        int not null default 0,
  errors          int not null default 0,
  finished        boolean not null default false,
  duration_ms     int,
  word_errors     jsonb not null default '{}'::jsonb,
  app_version     text,
  joined_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (room_id, session_id, student_key)
);

create index room_students_room_idx on room_students (room_id, session_id);

-- RLS aktiviert, aber bewusst ohne freigebende Policy für die Rollen
-- anon/authenticated -> direkter REST-Zugriff auf beide Tabellen ist
-- dadurch vollständig gesperrt. Die Policies unten sind rein dokumentierend
-- (Postgres würde ohne jede Policy ohnehin schon alles verweigern).
alter table rooms enable row level security;
alter table room_students enable row level security;

create policy rooms_deny_direct_access on rooms
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy room_students_deny_direct_access on room_students
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Erzeugt einen neuen Raum mit garantiert eindeutigem, aktivem Code.
-- Atomar dank rooms_active_code_uidx + Retry-Schleife: kein TOCTOU-Race,
-- selbst wenn mehrere Lehrer im selben Moment einen Raum öffnen.
create or replace function open_room(p_config jsonb default '{}'::jsonb)
returns table (room_id uuid, code text, access_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempt int := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_code := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
    begin
      return query
        insert into rooms (code, config)
        values (v_code, p_config)
        returning rooms.id, rooms.code, rooms.access_token;
      return;
    exception when unique_violation then
      if v_attempt >= 20 then
        raise exception 'Kein freier Raum-Code nach % Versuchen gefunden', v_attempt;
      end if;
      -- naechster Schleifendurchlauf wuerfelt einen neuen Code
    end;
  end loop;
end;
$$;

-- Einziger erlaubter Weg, einen Raum anhand des (öffentlichen) Codes zu
-- finden. Liefert nur das Minimum, das ein Client zum Beitreten braucht,
-- und nur für Räume, die tatsächlich noch Beitritte akzeptieren.
create or replace function find_active_room(p_code text)
returns table (room_id uuid, access_token text, station_mode boolean, status text)
language sql
security definer
set search_path = public
stable
as $$
  select id, access_token, station_mode, status
  from rooms
  where code = p_code and status in ('lobby', 'live')
  limit 1;
$$;

-- Sitzung starten/aktualisieren (Lehrer-Dashboard). Token-gated: ohne
-- passenden access_token passiert nichts (0 betroffene Zeilen -> Exception).
create or replace function update_session(
  p_room_id uuid,
  p_access_token text,
  p_session_id text,
  p_config jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rooms
  set status = 'live',
      session_id = p_session_id,
      config = p_config,
      station_mode = coalesce((p_config ->> 'stationMode')::boolean, station_mode),
      started_at = coalesce(started_at, now()),
      last_activity_at = now()
  where id = p_room_id and access_token = p_access_token;

  if not found then
    raise exception 'Ungueltiger Raum oder Token';
  end if;
end;
$$;

-- Sitzung beenden (Lehrer-Dashboard). Gibt den Code sofort wieder frei
-- (rooms_active_code_uidx deckt nur status <> 'ended' ab).
create or replace function end_room(p_room_id uuid, p_access_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rooms
  set status = 'ended', ended_at = now()
  where id = p_room_id and access_token = p_access_token;

  if not found then
    raise exception 'Ungueltiger Raum oder Token';
  end if;
end;
$$;

-- Hinweis fuer spaetere Phasen (noch nicht Teil dieser Migration):
-- - upsert_progress(...) fuer room_students kommt mit Phase 3.
-- - Ein Cleanup-Job (pg_cron/Edge Function) fuer verwaiste Raeume
--   (last_activity_at zu alt) ist ebenfalls fuer Phase 3 vorgesehen, siehe
--   Architektur-Plan, Abschnitt "Skalierungs-Punkte".
