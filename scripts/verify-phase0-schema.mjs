// Manuelle Verifikation der Phase-0-Migration (supabase/migrations/20260706120000_rooms_and_progress.sql).
// Bewusst KEIN Vitest-Test: legt/beendet echte Zeilen in der konfigurierten
// Supabase-Datenbank an. Sobald echte Zugangsdaten in .env stehen, würde ein
// Vitest-Test dasselbe bei jedem "npm run test" tun -- hier läuft es nur,
// wenn man es bewusst manuell aufruft.
//
// Voraussetzung: die Migration wurde bereits gegen das Supabase-Projekt
// angewendet (Supabase SQL Editor oder `supabase db push`).
//
// Aufruf:
//   node --env-file=.env scripts/verify-phase0-schema.mjs

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

const openRoom = async () => {
  const { data, error } = await supabase.rpc('open_room', { p_config: {} });
  if (error) throw new Error(`open_room fehlgeschlagen: ${error.message}`);
  return data[0];
};

console.log('--- Phase 0: Schema-Verifikation ---');

// 1. Zwei gleichzeitige open_room()-Aufrufe muessen unterschiedliche Codes liefern
// (Kollisionsschutz via rooms_active_code_uidx).
const [roomA, roomB] = await Promise.all([openRoom(), openRoom()]);
check('open_room() liefert zwei Raeume mit unterschiedlichem Code', roomA.code !== roomB.code);
check('access_token wird gesetzt und ist kein Leerstring', typeof roomA.access_token === 'string' && roomA.access_token.length > 0);

// 2. find_active_room() findet einen frisch angelegten (lobby) Raum per Code
// und gibt bewusst KEIN access_token heraus (Schueler duerfen keine
// Schreibrechte bekommen).
const { data: found, error: findError } = await supabase.rpc('find_active_room', { p_code: roomA.code });
check('find_active_room() findet den Raum ueber den Code', !findError && found?.[0]?.room_id === roomA.room_id);
check('find_active_room() gibt kein access_token heraus', found?.[0]?.access_token === undefined);

// 3. update_session() mit falschem Token wird abgelehnt.
const { error: badTokenError } = await supabase.rpc('update_session', {
  p_room_id: roomA.room_id,
  p_access_token: 'falscher-token',
  p_session_id: 'test-session',
  p_config: {},
});
check('update_session() mit falschem Token schlaegt fehl', !!badTokenError);

// 4. update_session() mit korrektem Token funktioniert.
const { error: goodTokenError } = await supabase.rpc('update_session', {
  p_room_id: roomA.room_id,
  p_access_token: roomA.access_token,
  p_session_id: 'test-session',
  p_config: { gameMode: 'LAUFDIKTAT' },
});
check('update_session() mit korrektem Token funktioniert', !goodTokenError);

// 4b. get_room_state() ist lesend fuer Schuelergeraete ohne Token nutzbar
// und liefert die zuvor per update_session() gesetzte Konfiguration.
const { data: state, error: stateError } = await supabase.rpc('get_room_state', { p_room_id: roomA.room_id });
check(
  'get_room_state() liefert Status/Config ohne Token',
  !stateError && state?.[0]?.status === 'live' && state?.[0]?.config?.gameMode === 'LAUFDIKTAT'
);

// 5. Raum beenden gibt den Code sofort wieder frei.
const { error: endError } = await supabase.rpc('end_room', {
  p_room_id: roomA.room_id,
  p_access_token: roomA.access_token,
});
check('end_room() funktioniert', !endError);

const { data: newlyOpened } = await supabase.rpc('open_room', { p_config: {} });
// Kein direkter Beweis, dass GENAU roomA.code wiederverwendet wird (der ist
// zufaellig neu gewuerfelt) -- aber ein beendeter Raum darf find_active_room
// nicht mehr liefern, das ist die eigentlich relevante Eigenschaft.
const { data: shouldBeGone } = await supabase.rpc('find_active_room', { p_code: roomA.code });
check('find_active_room() findet einen beendeten Raum nicht mehr', !shouldBeGone || shouldBeGone.length === 0);

// Aufraeumen der beim Testlauf erzeugten Raeume.
await supabase.rpc('end_room', { p_room_id: roomB.room_id, p_access_token: roomB.access_token });
await supabase.rpc('end_room', { p_room_id: newlyOpened[0].room_id, p_access_token: newlyOpened[0].access_token });

// 6. Direkter Tabellenzugriff muss durch RLS blockiert sein (deny-by-default).
const { data: directRows, error: directError } = await supabase.from('rooms').select('*').limit(1);
check('direkter Tabellenzugriff auf rooms liefert nichts (RLS greift)', !directError && (directRows?.length ?? 0) === 0);

console.log('---');
if (failures > 0) {
  console.error(`${failures} Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('Alle Pruefungen erfolgreich.');
