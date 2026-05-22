import { useMemo } from 'react';

/**
 * Sonderfall-Mapping für Tiernamen, deren Dateiname nicht durch die
 * Standard-Umlaut-Konvertierung erzeugt werden kann.
 * Key = lowercase Tiername, Value = tatsächlicher Dateiname (ohne .svg)
 */
const FILENAME_OVERRIDES: Record<string, string> = {
  'chamäleon':    'chameleon',
  'tiefseefisch': 'anglerfisch',
  'phönix':       'phoenix',
  'sphynx-katze': 'sphynxkatze',
  'spielzeugkatze': 'spielzeugkatze',
};

/**
 * Konvertiert einen Tiernamen in einen validen Dateinamen:
 * - toLowerCase()
 * - Umlaute: ä→ae, ö→oe, ü→ue, ß→ss
 * - Leerzeichen → _
 * - Bindestriche entfernen
 */
function toFileName(animal: string): string {
  const lower = animal.toLowerCase().trim();

  // Prüfe zuerst Sonderfälle
  if (FILENAME_OVERRIDES[lower]) {
    return FILENAME_OVERRIDES[lower];
  }

  return lower
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '_')
    .replace(/-/g, '');
}

/**
 * Splittet einen zusammengesetzten Tiernamen ("Schnelles Nashorn")
 * in Adjektiv und Tier auf.
 * Bei mehrteiligen Tiernamen (z.B. "Roter Panda", "Deutscher Schäferhund")
 * wird nur das erste Wort als Adjektiv genommen.
 */
function parseStudentName(name: string): { adjective: string; animal: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return {
      adjective: parts[0],
      animal: parts.slice(1).join(' '),
    };
  }
  return { adjective: '', animal: name.trim() };
}

interface AnimalAvatarProps {
  /** Der generierte Schülername, z.B. "Schnelles Nashorn" */
  studentName: string;
  /** Optionale zusätzliche CSS-Klassen (für Größe etc.) */
  className?: string;
}

/**
 * AnimalAvatar
 *
 * Rendert das Original-Tier-SVG basierend auf dem generierten Schülernamen.
 * Nutzt die SVG-Grafik direkt aus `/animals/` ohne farbliche Anpassungen.
 */
export const AnimalAvatar = ({ studentName, className = '' }: AnimalAvatarProps) => {
  const svgPath = useMemo(() => {
    const { animal } = parseStudentName(studentName);
    const fileName = toFileName(animal);
    return `/animals/${fileName}.svg`;
  }, [studentName]);

  return (
    <img
      src={svgPath}
      className={`object-contain ${className}`}
      alt={studentName}
    />
  );
};
