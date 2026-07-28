-- Verbindungsunabhaengiger Online-Heartbeat (siehe useGameRoom.ts /
-- useDashboardRoom.ts). Bisher war Supabase Presence die EINZIGE Quelle
-- dafuer, wer "gerade online" ist. Presence lebt aber ausschliesslich ueber
-- die WebSocket-Verbindung: Geht ein Tablet kurz in den Standby oder der Tab
-- in den Hintergrund, wird der Realtime-Heartbeat vom Browser gedrosselt, der
-- Server trennt die Verbindung, und der Schueler verschwindet aus der
-- Presence -- obwohl sein Geraet noch "angemeldet" zeigt. Zusaetzlich erkennt
-- Presence einen Abbruch strukturell erst nach 30-90s, was die "N verbunden"-
-- Anzeige spuerbar traege macht.
--
-- touch_participant_secure gibt dem Client einen leichtgewichtigen Weg, sich
-- regelmaessig als "noch da" zu markieren (room_participants.last_seen_at).
-- Das Dashboard liest diesen Zeitstempel (get_room_participants_secure liefert
-- ihn bereits) und wertet einen Teilnehmer als online, dessen last_seen_at
-- juenger als eine kleine Schwelle ist -- schnell und unabhaengig davon, wie
-- traege Presence einen Abbruch bemerkt. Presence bleibt als sofortiges
-- Beitritts-/Verlassen-Signal erhalten, entscheidet aber nicht mehr allein.
--
-- Sicherheitsmodell wie beim uebrigen Fortschritt: nur mit gueltigem
-- geraetegebundenem Teilnehmertoken (private.valid_participant). Ein Fremder
-- kann damit weder den Online-Status eines anderen Geraets faelschen noch die
-- Teilnehmerliste auslesen.

create or replace function public.touch_participant_secure(
  p_room_id uuid,
  p_participant_token text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_participant_id uuid;
begin
  select vp.participant_id into v_participant_id
  from private.valid_participant(p_room_id, p_participant_token) vp;
  if v_participant_id is null then
    raise exception 'Ungueltiger Teilnehmertoken';
  end if;

  update public.room_participants set last_seen_at = now() where id = v_participant_id;
  -- Haelt den Raum als "aktiv" (verhindert das vorzeitige Auto-Beenden durch
  -- cleanup_abandoned_rooms), solange noch Geraete verbunden sind -- auch
  -- waehrend der Lobby-Wartephase, bevor ueberhaupt eine Runde laeuft.
  update public.rooms set last_activity_at = now()
  where id = p_room_id and status <> 'ended';
end;
$$;

revoke all on function public.touch_participant_secure(uuid, text) from public;
grant execute on function public.touch_participant_secure(uuid, text) to anon, authenticated;
