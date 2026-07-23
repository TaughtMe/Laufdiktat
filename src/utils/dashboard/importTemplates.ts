/**
 * Herunterladbare Beispieldateien für den Upload. Die Inhalte liegen als
 * Konstanten hier (nicht als statische Dateien in /public), damit sie nicht in
 * den PWA-Precache wandern und der Download zur Laufzeit aus einem Blob entsteht.
 *
 * Wichtig: Die Mathe-Vorlage darf nur gültige Zeilen enthalten – ein Kommentar
 * würde im Import als „ungültige" Aufgabe erscheinen. Die Erklärung steht daher
 * im Info-Popover, nicht in der Datei. importTemplates.test.ts stellt sicher,
 * dass jede Mathe-Zeile tatsächlich parst.
 */

export interface ImportTemplate {
  /** Dateiname beim Download. */
  filename: string;
  /** Button-Beschriftung im Popover. */
  label: string;
  /** Ein-Zeilen-Hinweis: wofür die Vorlage gedacht ist / welche Regel dazu passt. */
  hint: string;
  /** Dateiinhalt. */
  content: string;
}

const SAETZE = `Der schnelle Fuchs springt über den Zaun. Er sucht nach Futter.
Am Morgen singen die Vögel im Wald. Ein Igel schläft noch tief im Laub.
Die Kinder gehen zur Schule. Danach spielen sie auf dem Hof.`;

const WORTLISTE = `Fahrrad
Sonne
Regenschirm
Freundschaft
Elefant
Marmelade
Schmetterling
Abenteuer`;

const ABSAETZE = `Der Herbst beginnt. Die Blätter färben sich bunt und fallen von den Bäumen.

Im Winter wird es kalt. Manchmal fällt Schnee und alles wird weiß.

Der Frühling bringt neue Blüten. Überall zwitschern die Vögel.`;

const MATHE = `4 + 4
12 − 5
6 · 7
20 : 4
15 + 27
100 − 48
\\frac{1}{2} + 3
\\sqrt{16}`;

/** Text-Vorlagen (Reiter „Text"). */
export const TEXT_TEMPLATES: ImportTemplate[] = [
  {
    filename: 'laufdiktat-vorlage-saetze.txt',
    label: 'Fließtext (nach Sätzen)',
    hint: 'Durchgehender Text – wird an Satzzeichen getrennt. Regel „Zeichen" an.',
    content: SAETZE,
  },
  {
    filename: 'laufdiktat-vorlage-wortliste.txt',
    label: 'Wortliste (eine pro Zeile)',
    hint: 'Ein Eintrag pro Zeile. Regel „Enter“ → jede neue Zeile, „Zeichen“ aus.',
    content: WORTLISTE,
  },
  {
    filename: 'laufdiktat-vorlage-absaetze.txt',
    label: 'Absätze (durch Leerzeile getrennt)',
    hint: 'Sinnabschnitte durch Leerzeilen. Regel „Enter“ → nur Leerzeilen.',
    content: ABSAETZE,
  },
];

/** Mathe-Vorlage (Reiter „Mathe"). */
export const MATH_TEMPLATE: ImportTemplate = {
  filename: 'laufdiktat-vorlage-mathe.txt',
  label: 'Aufgabenliste',
  hint: 'Eine Aufgabe pro Zeile. Ergebnisse werden automatisch berechnet.',
  content: MATHE,
};
