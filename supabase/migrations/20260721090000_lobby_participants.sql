-- Lobby-Uebersicht "angemeldet vs. verbunden" (siehe LobbyStep.tsx):
-- Das Dashboard sah bisher ausschliesslich Supabase Presence, also nur die
-- JETZT GERADE verbundenen Geraete. Ein Schueler, dessen Tablet kurz in den
-- Standby ging, fehlte damit kommentarlos in der Lobby, obwohl er laengst im
-- Raum registriert war ("18 angemeldet, 17 sichtbar").
--
-- get_room_participants_secure liefert zusaetzlich alle in der DB
-- registrierten Teilnehmer eines Raums -- ausschliesslich mit dem
-- Lehrer-access_token, analog zu get_room_students_secure. Schueler koennen
-- die Teilnehmerliste damit weiterhin nicht abfragen.
--
-- remove_room_participant_secure laesst die Lehrkraft einen laenger inaktiven
-- (ausgegrauten) Teilnehmer wieder aus dem Raum entfernen -- samt seinem
-- gespeicherten Fortschritt, damit er nicht als Geist in Ergebnisliste/CSV
-- haengen bleibt. Tritt derselbe Schueler danach erneut bei, bekommt er wie
-- ein Neuer eine frische Identitaet (join_room_secure).

create or replace function public.get_room_participants_secure(
  p_room_id uuid,
  p_access_token text
)
returns table (student_key text, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select rp.student_key, rp.last_seen_at
  from public.room_participants rp
  join public.rooms r on r.id = rp.room_id
  where rp.room_id = p_room_id
    and r.access_token = p_access_token
  order by rp.created_at;
$$;

create or replace function public.remove_room_participant_secure(
  p_room_id uuid,
  p_access_token text,
  p_student_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.access_token = p_access_token
  ) then
    raise exception 'Ungueltiger Raum oder Token';
  end if;

  delete from public.room_participants
  where room_id = p_room_id and student_key = p_student_key;

  delete from public.room_students
  where room_id = p_room_id and student_key = p_student_key;
end;
$$;

revoke all on function public.get_room_participants_secure(uuid, text) from public;
revoke all on function public.remove_room_participant_secure(uuid, text, text) from public;

grant execute on function public.get_room_participants_secure(uuid, text) to anon, authenticated;
grant execute on function public.remove_room_participant_secure(uuid, text, text) to anon, authenticated;
