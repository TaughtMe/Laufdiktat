-- Hotfix (siehe Code-Review des Architektur-Umbaus): upsert_progress() hat
-- word_errors bisher bei JEDEM Zwischenstand-Aufruf auf '{}' zurückgesetzt,
-- weil der Parameter-Default '{}'::jsonb war und die ON-CONFLICT-Klausel
-- (anders als bei duration_ms/app_version/station_number) keinen coalesce()
-- hatte. Game.tsx übergibt bei den laufenden Zwischenstand-Aufrufen bewusst
-- kein word_errors (nur der finale finished=true-Aufruf tut das) -- dadurch
-- wurde die Spalte bei jedem Tippfehler-Zwischenstand sofort wieder geleert.
--
-- Fix: Default auf NULL setzen und in der UPDATE-Klausel coalesce()
-- verwenden wie bei den anderen optionalen Feldern -- ein "nicht
-- mitgeschickt" (NULL) überschreibt den vorhandenen Wert dann nicht mehr,
-- nur ein explizit mitgeschickter Wert tut das.
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
  p_word_errors jsonb default null,
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
    p_duration_ms, coalesce(p_word_errors, '{}'::jsonb), p_app_version, now()
  )
  on conflict (room_id, session_id, student_key) do update
  set current_index  = excluded.current_index,
      peeks           = excluded.peeks,
      attempts        = excluded.attempts,
      errors          = excluded.errors,
      finished        = excluded.finished,
      duration_ms     = coalesce(excluded.duration_ms, room_students.duration_ms),
      -- Vorher: unconditional excluded.word_errors -- lief bei jedem
      -- Zwischenstand-Aufruf (ohne word_errors) auf '{}' zurueck. Jetzt wie
      -- die anderen optionalen Felder: ein nicht mitgeschickter Wert (NULL)
      -- laesst den zuletzt bekannten Stand unangetastet.
      word_errors     = coalesce(excluded.word_errors, room_students.word_errors),
      app_version     = coalesce(excluded.app_version, room_students.app_version),
      station_number  = coalesce(excluded.station_number, room_students.station_number),
      updated_at      = now();

  update rooms set last_activity_at = now() where id = p_room_id;
end;
$$;
