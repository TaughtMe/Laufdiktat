// Manuelle Verifikation der Phase-3-Migration (supabase/migrations/20260706130000_progress_and_cleanup.sql).
// Bewusst KEIN Vitest-Test, siehe verify-phase0-schema.mjs -- gleicher Grund.
// Voraussetzung: BEIDE Migrationen (Phase 0 + Phase 3) wurden bereits gegen
// das Supabase-Projekt angewendet.
//
// Aufruf:
//   node --env-file=.env scripts/verify-phase3-schema.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen. Mit "node --env-file=.env" aufrufen.');
  process.exit(1);
}

const supabase = createClient(url, anonKey);
let failures = 0;

const check = (label, condition) => {
  if (condition) {
    console.log(`OK   ${label}`);
  } else {
    console.error(`FAIL ${label}`);
    failures++;
  }
};

console.log('--- Phase 3: Schema-Verifikation ---');

const { data: roomRows, error: openError } = await supabase.rpc('open_room', { p_config: {} });
if (openError) {
  console.error(`open_room() fehlgeschlagen: ${openError.message}`);
  process.exit(1);
}
const room = roomRows[0];
const sessionId = 'test-session-phase3';

// 1. upsert_progress() legt eine neue Zeile an (kein Token noetig -- siehe
// Migrations-Kommentar: derselbe Vertrauensgrad wie heutige Broadcasts).
const { error: upsertError } = await supabase.rpc('upsert_progress', {
  p_room_id: room.room_id,
  p_session_id: sessionId,
  p_student_key: 'Schlauer Igel',
  p_current_index: 2,
  p_peeks: 1,
  p_attempts: 3,
  p_errors: 1,
  p_finished: false,
});
check('upsert_progress() legt eine Zeile an', !upsertError);

// 2. get_my_progress() liest genau diese Zeile zurueck (kein Token noetig).
const { data: mine, error: mineError } = await supabase.rpc('get_my_progress', {
  p_room_id: room.room_id,
  p_session_id: sessionId,
  p_student_key: 'Schlauer Igel',
});
check(
  'get_my_progress() liefert den gespeicherten Fortschritt',
  !mineError && mine?.[0]?.current_index === 2 && mine?.[0]?.attempts === 3
);

// 3. Ein zweiter upsert_progress()-Aufruf fuer denselben Schluessel
// AKTUALISIERT die Zeile (ON CONFLICT), statt eine zweite anzulegen.
await supabase.rpc('upsert_progress', {
  p_room_id: room.room_id,
  p_session_id: sessionId,
  p_student_key: 'Schlauer Igel',
  p_current_index: 5,
  p_peeks: 1,
  p_attempts: 6,
  p_errors: 1,
  p_finished: true,
  p_duration_ms: 12000,
});
const { data: updated } = await supabase.rpc('get_my_progress', {
  p_room_id: room.room_id,
  p_session_id: sessionId,
  p_student_key: 'Schlauer Igel',
});
check('upsert_progress() aktualisiert statt zu duplizieren', updated?.length === 1 && updated[0].current_index === 5 && updated[0].finished === true);

// 3b. Regressionstest fuer den word_errors-Coalesce-Fix (siehe
// 20260706140000_fix_word_errors_coalesce.sql): ein Zwischenstand-Aufruf
// OHNE word_errors darf einen zuvor gespeicherten Stand nicht loeschen.
await supabase.rpc('upsert_progress', {
  p_room_id: room.room_id,
  p_session_id: sessionId,
  p_student_key: 'Schlauer Igel',
  p_current_index: 6,
  p_peeks: 1,
  p_attempts: 7,
  p_errors: 1,
  p_finished: false,
  p_word_errors: { Haus: 2 },
});
await supabase.rpc('upsert_progress', {
  p_room_id: room.room_id,
  p_session_id: sessionId,
  p_student_key: 'Schlauer Igel',
  p_current_index: 7,
  p_peeks: 1,
  p_attempts: 8,
  p_errors: 1,
  p_finished: false,
  // p_word_errors bewusst weggelassen (Default null) -- genau der Aufruf,
  // den Game.tsx bei jedem Zwischenstand macht.
});
const { data: afterOmitted } = await supabase.rpc('get_room_students', {
  p_room_id: room.room_id,
  p_access_token: room.access_token,
});
check(
  'upsert_progress() ohne word_errors loescht einen vorhandenen Stand nicht',
  afterOmitted?.[0]?.word_errors?.Haus === 2
);

// 4. get_room_students() ohne Token schlaegt fehl/liefert nichts.
const { data: noTokenRows } = await supabase.rpc('get_room_students', {
  p_room_id: room.room_id,
  p_access_token: 'falscher-token',
});
check('get_room_students() ohne gueltigen Token liefert nichts', !noTokenRows || noTokenRows.length === 0);

// 5. get_room_students() MIT Token liefert die Zeile fuers Lehrer-Dashboard.
const { data: withToken, error: withTokenError } = await supabase.rpc('get_room_students', {
  p_room_id: room.room_id,
  p_access_token: room.access_token,
});
check(
  'get_room_students() mit gueltigem Token liefert alle Schueler des Raums',
  !withTokenError && withToken?.length === 1 && withToken[0].student_key === 'Schlauer Igel'
);

// 6. cleanup_abandoned_rooms() laesst frische Raeume unangetastet (last_activity_at
// wurde gerade erst durch upsert_progress() aktualisiert).
const { error: cleanupError } = await supabase.rpc('cleanup_abandoned_rooms');
const { data: stillActive } = await supabase.rpc('find_active_room', { p_code: room.code });
check('cleanup_abandoned_rooms() laeuft ohne Fehler', !cleanupError);
check('cleanup_abandoned_rooms() beendet frische Raeume nicht', stillActive?.length === 1);

// Aufraeumen.
await supabase.rpc('end_room', { p_room_id: room.room_id, p_access_token: room.access_token });

console.log('---');
if (failures > 0) {
  console.error(`${failures} Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('Alle Pruefungen erfolgreich.');
