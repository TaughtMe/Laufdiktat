// Gemeinsame Schritt-Definitionen für Header (Pill-Stepper) und Wizard-Footer.
export type DashboardStep = 'IMPORT' | 'SETTINGS' | 'LOBBY' | 'LIVE';

export const STEP_ORDER: DashboardStep[] = ['IMPORT', 'SETTINGS', 'LOBBY', 'LIVE'];

export const STEP_META: Record<DashboardStep, { label: string; title: string; pill: string }> = {
  IMPORT: { label: 'Schritt 1 von 4', title: 'Wortliste vorbereiten', pill: 'Diktat' },
  SETTINGS: { label: 'Schritt 2 von 4', title: 'Modus & Optionen', pill: 'Einstellungen' },
  LOBBY: { label: 'Schritt 3 von 4', title: 'Lobby', pill: 'Lobby' },
  LIVE: { label: 'Schritt 4 von 4', title: 'Live-Sitzung', pill: 'Live' },
};
