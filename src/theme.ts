// Klassenbasierter Dark-Mode: `.dark` auf <html> steuert alle `dark:`-Klassen
// und die Design-Token-Variablen (siehe index.css). Ohne gespeicherte Wahl
// folgt das Theme der System-Einstellung – exakt das bisherige Verhalten.
// Dieses Modul wird in main.tsx VOR dem React-Render importiert, damit die
// Seite nicht kurz im falschen Theme aufblitzt.

const THEME_KEY = 'laufdiktat_theme';

type Listener = (dark: boolean) => void;
const listeners = new Set<Listener>();

const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const readStored = (): 'light' | 'dark' | null => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
};

const applyClass = (dark: boolean) => {
  document.documentElement.classList.toggle('dark', dark);
  for (const l of listeners) l(dark);
};

export const isDarkTheme = () => document.documentElement.classList.contains('dark');

/** Umschalten und Wahl merken (überschreibt ab dann die System-Einstellung). */
export const toggleTheme = () => {
  const next = !isDarkTheme();
  try {
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  } catch { /* Privater Modus o.ä. – Theme gilt dann nur für diese Sitzung */ }
  applyClass(next);
};

export const subscribeTheme = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

// Initialisierung: gespeicherte Wahl > System-Einstellung.
const stored = readStored();
applyClass(stored !== null ? stored === 'dark' : systemPrefersDark());

// Solange der Nutzer nie manuell umgeschaltet hat, System-Wechseln live folgen.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (readStored() === null) applyClass(e.matches);
});
