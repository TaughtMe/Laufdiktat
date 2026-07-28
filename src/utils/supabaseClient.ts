import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Neue Publishable Keys sind fuer Browser gedacht und leichter rotierbar.
// Der Legacy-anon-Key bleibt waehrend der Umstellung als kompatibler Fallback.
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

if (!isSupabaseConfigured) {
  // Ohne gültige Zugangsdaten würde createClient() beim Laden des Moduls
  // eine Exception werfen und die gesamte App mit einer weißen Seite abstürzen
  // lassen. Stattdessen warnen wir deutlich und verwenden eine Platzhalter-URL,
  // damit die App lädt – die Echtzeit-Funktionen sind dann allerdings inaktiv.
  console.error(
    '[Supabase] VITE_SUPABASE_URL und/oder Publishable Key fehlen. ' +
      'Lege eine .env-Datei an (siehe .env.example). ' +
      'Die App lädt, aber die Echtzeit-Funktionen (Räume) funktionieren nicht.'
  );
}

// Web Worker nur nutzen, wo es ihn gibt. Im Browser ist das immer der Fall;
// unter Node (Vitest, environment: 'node') und in einem SSR-Kontext fehlt
// window.Worker -- supabase-js würde bei worker:true dort beim Anlegen des
// Clients hart werfen ("Web Worker is not supported"). Der Guard hält den
// Modul-Load in Tests grün.
const supportsWebWorker = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-publishable-key',
  {
    realtime: {
      // Kern der Presence-Robustheit: Der Realtime-Heartbeat hält die
      // WebSocket-Verbindung am Leben. Läuft er wie standardmäßig über einen
      // setInterval-Timer im Haupt-Thread, drosseln Browser ihn, sobald der Tab
      // in den Hintergrund geht oder der Bildschirm abdunkelt (Chrome ~1x/min,
      // iOS pausiert ihn ganz). Der Server bekommt dann keinen Heartbeat mehr
      // und trennt die Verbindung nach ~60s -- der Schüler fliegt aus der
      // Presence, obwohl sein Gerät noch "angemeldet" anzeigt (genau der
      // "17 von 19 online"-Fall). Im Web Worker laufen die Timer NICHT
      // gedrosselt weiter, wodurch die Verbindung kurze Hintergrund-Phasen
      // übersteht. supabase-js erzeugt den Worker aus einem gleich-Origin
      // Blob (kein Remote-Script); die CSP erlaubt das über
      // `worker-src 'self' blob:` (siehe public/_headers).
      worker: supportsWebWorker,
      // Kürzeres Intervall als der Standard (25s): Der Server erkennt einen
      // echten Abbruch schneller, und es bleibt mehr Puffer, bevor eine
      // (trotz Worker) gedrosselte Umgebung das Timeout-Fenster reißt.
      heartbeatIntervalMs: 15000,
    },
  }
);
