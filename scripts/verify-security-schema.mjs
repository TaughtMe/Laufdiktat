// Manueller Ende-zu-Ende-Test der 4.0.4-Sicherheits-RPCs gegen ein bewusst
// konfiguriertes Supabase-Projekt. Erzeugt einen pseudonymen Testraum und
// beendet ihn am Schluss wieder.

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !publishableKey) {
  console.error('VITE_SUPABASE_URL / Publishable Key fehlen. Mit "node --env-file=.env" aufrufen.');
  process.exit(1);
}

const supabase = createClient(url, publishableKey);
let failures = 0;
const check = (label, condition) => {
  if (condition) console.log(`OK   ${label}`);
  else { console.error(`FAIL ${label}`); failures++; }
};

console.log('--- Version 4.0.4: Sicherheits-Verifikation ---');

const { data: opened, error: openError } = await supabase.rpc('open_room_secure', { p_config: {} });
if (openError || !opened?.[0]) throw new Error(`open_room_secure: ${openError?.message ?? 'keine Daten'}`);
const room = opened[0];

const { data: joined, error: joinError } = await supabase.rpc('join_room_secure', {
  p_code: room.code,
  p_student_key: 'Sicherheits-Testtier',
  p_participant_token: null,
});
const participant = joined?.[0];
check('join_room_secure() erstellt einen Teilnehmertoken', !joinError && participant?.participant_token?.length === 48);

const sessionId = crypto.randomUUID();
const config = {
  words: [{ id: crypto.randomUUID(), targetWord: 'Test', isCompleted: false }],
  gameMode: 'LAUFDIKTAT', stationMode: false, stationCount: 24, appVersion: '4.0.4',
};
const { error: startError } = await supabase.rpc('update_session_secure', {
  p_room_id: room.room_id, p_access_token: room.access_token,
  p_session_id: sessionId, p_config: config,
});
check('Lehrertoken startet die Sitzung', !startError);

const { data: state, error: stateError } = await supabase.rpc('get_room_state_secure', {
  p_room_id: room.room_id, p_participant_token: participant.participant_token, p_access_token: null,
});
check('Teilnehmertoken liest den autorisierten Raumzustand', !stateError && state?.[0]?.session_id === sessionId);

const progressArgs = {
  p_room_id: room.room_id, p_session_id: sessionId,
  p_participant_token: participant.participant_token,
  p_student_key: participant.assigned_student_key,
  p_current_index: 0, p_peeks: 1, p_attempts: 1, p_errors: 0,
  p_finished: true, p_duration_ms: 1000, p_word_errors: {},
  p_app_version: '4.0.4', p_station_number: null,
};
const { error: progressError } = await supabase.rpc('upsert_progress_secure', progressArgs);
check('Gueltiger Teilnehmertoken speichert eigenen Fortschritt', !progressError);

const { error: forgedError } = await supabase.rpc('upsert_progress_secure', {
  ...progressArgs, p_participant_token: '0'.repeat(48), p_errors: 99,
});
check('Falscher Teilnehmertoken wird abgelehnt', !!forgedError);

const { data: mine } = await supabase.rpc('get_my_progress_secure', {
  p_room_id: room.room_id, p_session_id: sessionId,
  p_participant_token: participant.participant_token,
  p_student_key: participant.assigned_student_key,
});
check('Teilnehmer liest nur den eigenen Fortschritt', mine?.[0]?.finished === true && mine?.[0]?.errors === 0);

const { data: students } = await supabase.rpc('get_room_students_secure', {
  p_room_id: room.room_id, p_access_token: room.access_token,
});
check('Lehrertoken liest die Ergebnisliste', students?.length === 1);

// Lobby-Uebersicht "angemeldet vs. verbunden": die Teilnehmerliste ist eine
// personenbezogene Zusammenstellung und darf ausschliesslich mit dem
// Lehrertoken lesbar sein -- niemals mit einem Schueler-Teilnehmertoken oder
// einem geratenen Wert.
const { data: participants } = await supabase.rpc('get_room_participants_secure', {
  p_room_id: room.room_id, p_access_token: room.access_token,
});
check('Lehrertoken liest die Teilnehmerliste', participants?.length === 1);

const { data: foreignParticipants } = await supabase.rpc('get_room_participants_secure', {
  p_room_id: room.room_id, p_access_token: participant.participant_token,
});
check('Schuelertoken liest die Teilnehmerliste NICHT', (foreignParticipants?.length ?? 0) === 0);

const { error: forgedRemoveError } = await supabase.rpc('remove_room_participant_secure', {
  p_room_id: room.room_id, p_access_token: participant.participant_token,
  p_student_key: participant.assigned_student_key,
});
check('Schuelertoken darf niemanden entfernen', !!forgedRemoveError);

const { error: removeError } = await supabase.rpc('remove_room_participant_secure', {
  p_room_id: room.room_id, p_access_token: room.access_token,
  p_student_key: participant.assigned_student_key,
});
check('Lehrertoken entfernt einen Teilnehmer', !removeError);

const { data: afterRemoval } = await supabase.rpc('get_room_participants_secure', {
  p_room_id: room.room_id, p_access_token: room.access_token,
});
check('Entfernter Teilnehmer ist verschwunden', (afterRemoval?.length ?? 0) === 0);

const { data: studentsAfterRemoval } = await supabase.rpc('get_room_students_secure', {
  p_room_id: room.room_id, p_access_token: room.access_token,
});
check('Fortschritt des Entfernten ist mitgeloescht', (studentsAfterRemoval?.length ?? 0) === 0);

const { data: directRows, error: directError } = await supabase.from('rooms').select('*').limit(1);
check('Direkter Tabellenzugriff bleibt gesperrt', !!directError || (directRows?.length ?? 0) === 0);

const { error: cleanupError } = await supabase.rpc('cleanup_abandoned_rooms');
check('Browser darf Cleanup nicht ausfuehren', !!cleanupError);

await supabase.rpc('end_room_secure', { p_room_id: room.room_id, p_access_token: room.access_token });

console.log('---');
if (failures > 0) {
  console.error(`${failures} Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('Alle Sicherheitspruefungen erfolgreich.');
