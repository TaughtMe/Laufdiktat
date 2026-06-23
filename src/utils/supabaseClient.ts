import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Ohne gültige Zugangsdaten würde createClient() beim Laden des Moduls
  // eine Exception werfen und die gesamte App mit einer weißen Seite abstürzen
  // lassen. Stattdessen warnen wir deutlich und verwenden eine Platzhalter-URL,
  // damit die App lädt – die Echtzeit-Funktionen sind dann allerdings inaktiv.
  console.error(
    '[Supabase] VITE_SUPABASE_URL und/oder VITE_SUPABASE_ANON_KEY fehlen. ' +
      'Lege eine .env-Datei an (siehe .env.example). ' +
      'Die App lädt, aber die Echtzeit-Funktionen (Räume) funktionieren nicht.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
