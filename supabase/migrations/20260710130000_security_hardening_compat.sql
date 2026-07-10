-- Version 4.0.4: additive, rueckwaertskompatible Sicherheitsschicht.
--
-- Diese Migration fuehrt geraetebezogene Teilnehmertokens und abgesicherte
-- RPC-v2-Funktionen ein. Die alten RPCs bleiben fuer die kurze Rollout-Phase
-- noch vorhanden, damit bereits geoeffnete 4.0.3-PWAs nicht mitten in einer
-- Stunde ausfallen. Nach dem Frontend-Deployment sperrt die Folgemigration
-- 20260710140000_security_hardening_finalize.sql die alten RPCs.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create extension if not exists pg_cron;

create table if not exists public.room_participants (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references public.rooms(id) on delete cascade,
  student_key        text not null,
  token_hash         text not null,
  created_at         timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  unique (room_id, student_key),
  unique (room_id, token_hash),
  constraint room_participants_student_key_valid
    check (length(student_key) between 1 and 64 and student_key !~ '[[:cntrl:]]'),
  constraint room_participants_token_hash_valid
    check (token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists room_participants_room_idx
  on public.room_participants (room_id, last_seen_at desc);

alter table public.room_participants enable row level security;
drop policy if exists room_participants_deny_direct_access on public.room_participants;
create policy room_participants_deny_direct_access on public.room_participants
  for all to anon, authenticated using (false) with check (false);

revoke all on table public.rooms, public.room_students, public.room_participants
  from public, anon, authenticated;

-- Vorhandene Daten liegen weit innerhalb dieser Grenzen. Die Limits sind
-- bewusst grosszuegig und beeinflussen normale Unterrichtssitzungen nicht,
-- verhindern aber negative Zaehler und unbeschraenkte JSON-/Text-Payloads.
alter table public.rooms
  drop constraint if exists rooms_code_format_check,
  add constraint rooms_code_format_check check (code ~ '^[0-9]{4}$'),
  drop constraint if exists rooms_config_size_check,
  add constraint rooms_config_size_check check (octet_length(config::text) <= 1048576);

alter table public.room_students
  add column if not exists participant_id uuid references public.room_participants(id) on delete set null,
  drop constraint if exists room_students_session_id_size_check,
  add constraint room_students_session_id_size_check check (length(session_id) between 1 and 64),
  drop constraint if exists room_students_student_key_size_check,
  add constraint room_students_student_key_size_check check (length(student_key) between 1 and 64 and student_key !~ '[[:cntrl:]]'),
  drop constraint if exists room_students_current_index_check,
  add constraint room_students_current_index_check check (current_index between 0 and 10000),
  drop constraint if exists room_students_peeks_check,
  add constraint room_students_peeks_check check (peeks between 0 and 100000),
  drop constraint if exists room_students_attempts_check,
  add constraint room_students_attempts_check check (attempts between 0 and 100000),
  drop constraint if exists room_students_errors_check,
  add constraint room_students_errors_check check (errors between 0 and 100000),
  drop constraint if exists room_students_duration_check,
  add constraint room_students_duration_check check (duration_ms is null or duration_ms between 0 and 86400000),
  drop constraint if exists room_students_word_errors_size_check,
  add constraint room_students_word_errors_size_check check (
    jsonb_typeof(word_errors) = 'object' and octet_length(word_errors::text) <= 65536
  ),
  drop constraint if exists room_students_app_version_size_check,
  add constraint room_students_app_version_size_check check (app_version is null or length(app_version) <= 32),
  drop constraint if exists room_students_station_number_check,
  add constraint room_students_station_number_check check (station_number is null or station_number between 1 and 200);

create index if not exists room_students_participant_idx
  on public.room_students (participant_id, room_id, session_id)
  where participant_id is not null;

create table if not exists private.request_limits (
  scope       text not null,
  key_hash    text not null,
  requested_at timestamptz not null default now()
);

create index if not exists request_limits_lookup_idx
  on private.request_limits (scope, key_hash, requested_at desc);

create or replace function private.request_key_hash()
returns text
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_headers jsonb;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  exception when others then
    v_ip := null;
  end;
  return encode(extensions.digest(coalesce(v_ip, 'unknown'), 'sha256'), 'hex');
end;
$$;

create or replace function private.enforce_rate_limit(
  p_scope text,
  p_max_requests int,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_key text := private.request_key_hash();
  v_count bigint;
begin
  delete from private.request_limits
  where requested_at < now() - interval '1 day';

  select count(*) into v_count
  from private.request_limits
  where scope = p_scope
    and key_hash = v_key
    and requested_at >= now() - p_window;

  if v_count >= p_max_requests then
    raise exception 'Zu viele Anfragen. Bitte kurz warten.' using errcode = 'P0001';
  end if;

  insert into private.request_limits(scope, key_hash) values (p_scope, v_key);
end;
$$;

create or replace function private.valid_participant(
  p_room_id uuid,
  p_participant_token text
)
returns table(participant_id uuid, student_key text)
language sql
stable
security definer
set search_path = public, extensions, pg_catalog
as $$
  select rp.id, rp.student_key
  from public.room_participants rp
  where rp.room_id = p_room_id
    and p_participant_token ~ '^[0-9a-f]{48}$'
    and rp.token_hash = encode(extensions.digest(p_participant_token, 'sha256'), 'hex')
  limit 1;
$$;

revoke all on function private.request_key_hash() from public, anon, authenticated;
revoke all on function private.enforce_rate_limit(text, int, interval) from public, anon, authenticated;
revoke all on function private.valid_participant(uuid, text) from public, anon, authenticated;

create or replace function public.open_room_secure(p_config jsonb default '{}'::jsonb)
returns table (room_id uuid, code text, access_token text)
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog
as $$
declare
  v_code text;
  v_attempt int := 0;
begin
  if jsonb_typeof(coalesce(p_config, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_config, '{}'::jsonb)::text) > 1048576 then
    raise exception 'Ungueltige oder zu grosse Raumkonfiguration';
  end if;

  perform private.enforce_rate_limit('open_room', 60, interval '10 minutes');

  loop
    v_attempt := v_attempt + 1;
    v_code := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
    begin
      return query
        insert into public.rooms (code, config)
        values (v_code, coalesce(p_config, '{}'::jsonb))
        returning rooms.id, rooms.code, rooms.access_token;
      return;
    exception when unique_violation then
      if v_attempt >= 20 then
        raise exception 'Kein freier Raum-Code nach % Versuchen gefunden', v_attempt;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.join_room_secure(
  p_code text,
  p_student_key text,
  p_participant_token text default null
)
returns table (
  room_id uuid,
  station_mode boolean,
  status text,
  assigned_student_key text,
  participant_token text
)
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog
as $$
declare
  v_room public.rooms%rowtype;
  v_participant public.room_participants%rowtype;
  v_base_name text := trim(p_student_key);
  v_name text;
  v_token text;
  v_suffix int := 1;
begin
  if p_code !~ '^[0-9]{4}$' then
    return;
  end if;
  if length(v_base_name) not between 1 and 60 or v_base_name ~ '[[:cntrl:]]' then
    raise exception 'Ungueltiger Teilnehmername';
  end if;

  select * into v_room
  from public.rooms r
  where r.code = p_code and r.status in ('lobby', 'live')
  limit 1;
  if not found then return; end if;

  if p_participant_token is not null and p_participant_token ~ '^[0-9a-f]{48}$' then
    select * into v_participant
    from public.room_participants rp
    where rp.room_id = v_room.id
      and rp.token_hash = encode(extensions.digest(p_participant_token, 'sha256'), 'hex')
    limit 1;
    if found then
      update public.room_participants set last_seen_at = now() where id = v_participant.id;
      return query select v_room.id, v_room.station_mode, v_room.status, v_participant.student_key, p_participant_token;
      return;
    end if;
  end if;

  perform private.enforce_rate_limit('join_room', 600, interval '10 minutes');
  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  loop
    v_name := case
      when v_suffix = 1 then v_base_name
      else left(v_base_name, 60 - length(v_suffix::text) - 1) || ' ' || v_suffix::text
    end;
    begin
      insert into public.room_participants(room_id, student_key, token_hash)
      values (v_room.id, v_name, encode(extensions.digest(v_token, 'sha256'), 'hex'))
      returning * into v_participant;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      if v_suffix > 999 then raise exception 'Kein freier Teilnehmername'; end if;
    end;
  end loop;

  return query select v_room.id, v_room.station_mode, v_room.status, v_participant.student_key, v_token;
end;
$$;

create or replace function public.get_room_state_secure(
  p_room_id uuid,
  p_participant_token text default null,
  p_access_token text default null
)
returns table(status text, session_id text, config jsonb)
language sql
stable
security definer
set search_path = public, private, pg_catalog
as $$
  select r.status, r.session_id, r.config
  from public.rooms r
  where r.id = p_room_id
    and (
      (p_access_token is not null and r.access_token = p_access_token)
      or exists (
        select 1 from private.valid_participant(r.id, p_participant_token)
      )
    )
  limit 1;
$$;

create or replace function public.update_session_secure(
  p_room_id uuid,
  p_access_token text,
  p_session_id text,
  p_config jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Ungueltige Sitzungs-ID';
  end if;
  if jsonb_typeof(p_config) <> 'object' or octet_length(p_config::text) > 1048576 then
    raise exception 'Ungueltige oder zu grosse Raumkonfiguration';
  end if;
  if jsonb_typeof(p_config -> 'words') <> 'array'
     or jsonb_array_length(p_config -> 'words') not between 1 and 2000 then
    raise exception 'Ungueltige Aufgabenliste';
  end if;

  update public.rooms
  set status = 'live', session_id = p_session_id, config = p_config,
      station_mode = coalesce((p_config ->> 'stationMode')::boolean, station_mode),
      started_at = coalesce(started_at, now()), last_activity_at = now()
  where id = p_room_id and access_token = p_access_token;
  if not found then raise exception 'Ungueltiger Raum oder Token'; end if;
end;
$$;

create or replace function public.end_room_secure(p_room_id uuid, p_access_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.rooms
  set status = 'ended', ended_at = now(), last_activity_at = now()
  where id = p_room_id and access_token = p_access_token;
  if not found then raise exception 'Ungueltiger Raum oder Token'; end if;
end;
$$;

create or replace function public.upsert_progress_secure(
  p_room_id uuid,
  p_session_id text,
  p_participant_token text,
  p_student_key text,
  p_current_index int,
  p_peeks int default 0,
  p_attempts int default 0,
  p_errors int default 0,
  p_finished boolean default false,
  p_duration_ms int default null,
  p_word_errors jsonb default null,
  p_app_version text default null,
  p_station_number int default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_id uuid;
  v_assigned_name text;
  v_student_key text;
  v_word_count int;
  v_station_count int;
begin
  select r.* into v_room from public.rooms r
  where r.id = p_room_id and r.status = 'live' and r.session_id = p_session_id;
  if not found then raise exception 'Raum oder Sitzung ist nicht aktiv'; end if;

  select vp.participant_id, vp.student_key into v_participant_id, v_assigned_name
  from private.valid_participant(p_room_id, p_participant_token) vp;
  if v_participant_id is null then raise exception 'Ungueltiger Teilnehmertoken'; end if;

  v_word_count := case when jsonb_typeof(v_room.config -> 'words') = 'array'
    then jsonb_array_length(v_room.config -> 'words') else 0 end;
  if p_current_index < 0 or p_current_index >= greatest(v_word_count, 1) then
    raise exception 'Ungueltiger Fortschrittsindex';
  end if;
  if p_peeks not between 0 and 100000 or p_attempts not between 0 and 100000
     or p_errors not between 0 and 100000 then
    raise exception 'Ungueltige Zaehlerwerte';
  end if;
  if p_duration_ms is not null and p_duration_ms not between 0 and 86400000 then
    raise exception 'Ungueltige Dauer';
  end if;
  if p_word_errors is not null and (
    jsonb_typeof(p_word_errors) <> 'object' or octet_length(p_word_errors::text) > 65536
  ) then raise exception 'Ungueltige Fehlerstatistik'; end if;
  if p_app_version is not null and length(p_app_version) > 32 then
    raise exception 'Ungueltige App-Version';
  end if;

  if p_station_number is not null then
    v_station_count := least(200, greatest(1, coalesce((v_room.config ->> 'stationCount')::int, 24)));
    if not v_room.station_mode or p_station_number not between 1 and v_station_count then
      raise exception 'Ungueltige Stationsnummer';
    end if;
    v_student_key := 'station-' || p_station_number::text;
  else
    v_student_key := v_assigned_name;
  end if;

  insert into public.room_students (
    room_id, session_id, student_key, participant_id, station_number,
    current_index, peeks, attempts, errors, finished,
    duration_ms, word_errors, app_version, updated_at
  ) values (
    p_room_id, p_session_id, v_student_key, v_participant_id, p_station_number,
    p_current_index, p_peeks, p_attempts, p_errors, p_finished,
    p_duration_ms, coalesce(p_word_errors, '{}'::jsonb), p_app_version, now()
  )
  on conflict (room_id, session_id, student_key) do update
  set participant_id = excluded.participant_id,
      current_index = excluded.current_index,
      peeks = excluded.peeks,
      attempts = excluded.attempts,
      errors = excluded.errors,
      finished = excluded.finished,
      duration_ms = coalesce(excluded.duration_ms, room_students.duration_ms),
      word_errors = coalesce(p_word_errors, room_students.word_errors),
      app_version = coalesce(excluded.app_version, room_students.app_version),
      station_number = coalesce(excluded.station_number, room_students.station_number),
      updated_at = now()
  where room_students.station_number is not null
     or room_students.participant_id is null
     or room_students.participant_id = excluded.participant_id;

  if not found then raise exception 'Teilnehmername ist bereits einem anderen Geraet zugeordnet'; end if;
  update public.room_participants set last_seen_at = now() where id = v_participant_id;
  update public.rooms set last_activity_at = now() where id = p_room_id;
end;
$$;

create or replace function public.get_my_progress_secure(
  p_room_id uuid,
  p_session_id text,
  p_participant_token text,
  p_student_key text default null
)
returns table(current_index int, peeks int, attempts int, errors int, finished boolean)
language plpgsql
stable
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_participant_id uuid;
  v_assigned_name text;
  v_lookup_key text;
begin
  select vp.participant_id, vp.student_key into v_participant_id, v_assigned_name
  from private.valid_participant(p_room_id, p_participant_token) vp;
  if v_participant_id is null then return; end if;

  v_lookup_key := case
    when p_student_key ~ '^station-[0-9]{1,3}$' then p_student_key
    else v_assigned_name
  end;

  return query
  select rs.current_index, rs.peeks, rs.attempts, rs.errors, rs.finished
  from public.room_students rs
  join public.rooms r on r.id = rs.room_id
  where rs.room_id = p_room_id
    and rs.session_id = p_session_id
    and r.session_id = p_session_id
    and rs.student_key = v_lookup_key
    and (rs.station_number is not null or rs.participant_id = v_participant_id);
end;
$$;

create or replace function public.get_room_students_secure(p_room_id uuid, p_access_token text)
returns setof public.room_students
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select rs.* from public.room_students rs
  join public.rooms r on r.id = rs.room_id
  where rs.room_id = p_room_id and r.access_token = p_access_token;
$$;

-- Datenschutz und Code-Pool: inaktive Raeume beenden, beendete Raeume samt
-- kaskadierenden Teilnehmer-/Fortschrittsdaten nach 24 Stunden loeschen.
create or replace function public.cleanup_abandoned_rooms()
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  update public.rooms
  set status = 'ended', ended_at = now()
  where status <> 'ended' and last_activity_at < now() - interval '3 hours';

  delete from public.rooms
  where status = 'ended'
    and coalesce(ended_at, created_at) < now() - interval '24 hours';

  delete from private.request_limits
  where requested_at < now() - interval '1 day';
end;
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-abandoned-rooms';

select cron.schedule(
  'cleanup-abandoned-rooms',
  '*/15 * * * *',
  'select public.cleanup_abandoned_rooms()'
);

-- Der Cleanup darf niemals aus dem Browser aufrufbar sein.
revoke all on function public.cleanup_abandoned_rooms() from public, anon, authenticated;
grant execute on function public.cleanup_abandoned_rooms() to service_role;

revoke all on function public.open_room_secure(jsonb) from public;
revoke all on function public.join_room_secure(text, text, text) from public;
revoke all on function public.get_room_state_secure(uuid, text, text) from public;
revoke all on function public.update_session_secure(uuid, text, text, jsonb) from public;
revoke all on function public.end_room_secure(uuid, text) from public;
revoke all on function public.upsert_progress_secure(uuid, text, text, text, int, int, int, int, boolean, int, jsonb, text, int) from public;
revoke all on function public.get_my_progress_secure(uuid, text, text, text) from public;
revoke all on function public.get_room_students_secure(uuid, text) from public;

grant execute on function public.open_room_secure(jsonb) to anon, authenticated;
grant execute on function public.join_room_secure(text, text, text) to anon, authenticated;
grant execute on function public.get_room_state_secure(uuid, text, text) to anon, authenticated;
grant execute on function public.update_session_secure(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.end_room_secure(uuid, text) to anon, authenticated;
grant execute on function public.upsert_progress_secure(uuid, text, text, text, int, int, int, int, boolean, int, jsonb, text, int) to anon, authenticated;
grant execute on function public.get_my_progress_secure(uuid, text, text, text) to anon, authenticated;
grant execute on function public.get_room_students_secure(uuid, text) to anon, authenticated;
