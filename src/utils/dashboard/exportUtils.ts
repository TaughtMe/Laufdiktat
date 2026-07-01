export interface Student {
  name: string;
  reachedStation: string | number;
  progressPercent: number;
  errors?: number;
  attempts?: number;
  peeks?: number;
  stars?: number;
}

const escape = (val: unknown): string => {
  const s = String(val);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/**
 * Baut den CSV-Inhalt (Semikolon-getrennt für deutsches Excel, mit UTF-8-BOM).
 * Optional wird ein "Häufigste Fehler"-Ranking angehängt. Reine Funktion, damit
 * sie ohne DOM/Blob testbar ist.
 */
export const buildCsvContent = (
  students: Student[],
  wordErrors?: Array<[string, number]>
): string => {
  const hasDetails = students.some((s) => s.attempts !== undefined || s.errors !== undefined);
  const headers = hasDetails
    ? ['Name', 'Status', 'Fortschritt_Prozent', 'Fehler', 'Versuche', 'Spicker', 'Sterne']
    : ['Name', 'Erreichte_Station', 'Fortschritt_Prozent'];

  const csvRows = [headers.join(';')];

  for (const s of students) {
    const row = hasDetails
      ? [s.name, s.reachedStation, `${s.progressPercent}%`, s.errors ?? '', s.attempts ?? '', s.peeks ?? '', s.stars ?? '']
      : [s.name, s.reachedStation, `${s.progressPercent}%`];
    csvRows.push(row.map(escape).join(';'));
  }

  if (wordErrors && wordErrors.length > 0) {
    csvRows.push('');
    csvRows.push(['Häufigste Fehler', 'Anzahl'].join(';'));
    for (const [word, count] of wordErrors) {
      csvRows.push([escape(word), count].join(';'));
    }
  }

  return '﻿' + csvRows.join('\n');
};

/**
 * Exportiert Schülerergebnisse als CSV-Datei (Download-Dialog im Browser).
 */
export const exportResultsToCSV = (
  students: Student[],
  wordErrors?: Array<[string, number]>
) => {
  const csvContent = buildCsvContent(students, wordErrors);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `laufdiktat_ergebnisse_${new Date().toISOString().split('T')[0]}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
