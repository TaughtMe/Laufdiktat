-- Phase 3 (siehe Architektur-Plan "Migration: von reinen Realtime-Broadcasts
-- zu persistiertem Raum-/Fortschritts-Zustand"): Fortschritt serverseitig
-- persistieren, Direkt-/Stationsmodus vereinheitlichen.
--
-- Sicherheitsmodell für upsert_progress()/get_my_progress(): bewusst OHNE
-- access_token, nur über room_id gegated -- exakt derselbe Vertrauensgrad
-- wie heute schon bei den Broadcasts (jeder Client im Raum-Channel kann
-- bereits heute ein gefälschtes student-progress-Broadcast für einen
-- beliebigen Namen senden). Das ist also keine Verschlechterung gegenüber
-- dem Status quo, nur eine dauerhafte statt flüchtige Ablage. Ein Schüler
-- kennt seine eigene room_id ohnehin schon aus find_active_room()/
-- get_room_state(). get_room_students() (fürs Lehrer-Dashboard, liest ALLE
-- Schüler eines Raums) bleibt dagegen token-gated wie die anderen
-- Lehrer-Funktionen.

-- Schreibt/aktualisiert den Fortschritt genau eines Schülers (Direkt- UND
-- Stationsmodus, vereinheitlicht über student_key). ON CONFLICT macht das
-- von Natur aus idempotent -- ein wiederholter Aufruf mit demselben Stand
-- (z. B. nach einem Reconnect) verändert nichts zusätzlich.
create or replace function upsert_progress(
  p_room_id uuid,
  p_session_id text,
  p_student_key text,
  p_current_index int,
  p_peeks int default 0,
  p_attempts int default 0,
  p_errors int default 0,
  p_finished boolean default false,
  p_duration_ms int default null,
  p_word_errors jsonb default '{}'::jsonb,
  p_app_version text default null,
  p_station_number int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into room_students (
    room_id, session_id, student_key, station_number,
    current_index, peeks, attempts, errors, finished,
    duration_ms, word_errors, app_version, updated_at
  )
  values (
    p_room_id, p_session_id, p_student_key, p_station_number,
    p_current_index, p_peeks, p_attempts, p_errors, p_finished,
    p_duration_ms, p_word_errors, p_app_version, now()
  )
  on conflict (room_id, session_id, student_key) do update
  set current_index  = excluded.current_index,
      peeks           = excluded.peeks,
      attempts        = excluded.attempts,
      errors          = excluded.errors,
      finished        = excluded.finished,
      -- duration_ms/app_version werden nur beim Abschluss mitgeschickt;
      -- bei einem laufenden Zwischenstand (beide null) den zuletzt
      -- bekannten Wert nicht versehentlich überschreiben.
      duration_ms     = coalesce(excluded.duration_ms, room_students.duration_ms),
      -- Fehlerhaft (bei jedem Zwischenstand-Aufruf ohne word_errors wurde die
      -- Spalte auf '{}' zurueckgesetzt) -- behoben in
      -- 20260706140000_fix_word_errors_coalesce.sql, siehe dort.
      word_errors     = excluded.word_errors,
      app_version     = coalesce(excluded.app_version, room_students.app_version),
      station_number  = coalesce(excluded.station_number, room_students.station_number),
      updated_at      = now();

  update rooms set last_activity_at = now() where id = p_room_id;
end;
$$;

-- Liest den eigenen Fortschritt zurück (Resync nach Reload/Gerätewechsel).
create or replace function get_my_progress(p_room_id uuid, p_session_id text, p_student_key text)
returns table (current_index int, peeks int, attempts int, errors int, finished boolean)
language sql
security definer
set search_path = public
stable
as $$
  select current_index, peeks, attempts, errors, finished
  from room_students
  where room_id = p_room_id and session_id = p_session_id and student_key = p_student_key;
$$;

-- Liest den Fortschritt ALLER Schüler eines Raums (Lehrer-Dashboard) --
-- token-gated wie die anderen Lehrer-Funktionen, da hier (anders als bei
-- get_my_progress) Daten anderer Personen offengelegt werden.
create or replace function get_room_students(p_room_id uuid, p_access_token text)
returns setof room_students
language sql
security definer
set search_path = public
stable
as $$
  select rs.*
  from room_students rs
  join rooms r on r.id = rs.room_id
  where rs.room_id = p_room_id and r.access_token = p_access_token;
$$;

-- Verwaiste Räume schließen (Lehrer hat "Sitzung beenden" nie geklickt) --
-- gibt ihren Code wieder frei (siehe rooms_active_code_uidx) und verhindert,
-- dass sie bei "ganze Schule, viele parallele Räume" den Code-Pool dauerhaft
-- verstopfen. last_activity_at wird von update_session()/upsert_progress()
-- laufend aktualisiert, eine echte 2-Stunden-Sitzung wird also nicht
-- faelschlich als verwaist markiert.
create or replace function cleanup_abandoned_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  update rooms
  set status = 'ended', ended_at = now()
  where status <> 'ended' and last_activity_at < now() - interval '3 hours';
$$;

-- HINWEIS: Diese Funktion muss noch geplant werden -- nicht Teil dieser
-- Migration, da pg_cron nicht auf jedem Supabase-Tarif verfügbar ist.
-- Optionen:
--   a) pg_cron-Extension aktivieren (Dashboard -> Database -> Extensions),
--      dann einmalig ausführen:
--        select cron.schedule('cleanup-abandoned-rooms', '*/15 * * * *',
--          'select cleanup_abandoned_rooms()');
--   b) Ohne pg_cron: eine Supabase Edge Function, die cleanup_abandoned_rooms()
--      aufruft, per externem Scheduler (z. B. GitHub Actions Cron, cron-job.org)
--      alle paar Minuten anstoßen.
