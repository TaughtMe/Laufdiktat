import { useMemo } from 'react';

/**
 * Mapping: Adjektiv → Hintergrundfarbe (Tailwind-Klasse)
 * Jedes Adjektiv aus der Namensgenerierung bekommt eine eigene, kräftige Farbe.
 */
const ADJECTIVE_COLOR_MAP: Record<string, string> = {
  schnelles:  'bg-red-500',
  flinkes:    'bg-cyan-500',
  schlaues:   'bg-blue-500',
  mutiges:    'bg-amber-500',
  wildes:     'bg-orange-500',
  kühnes:     'bg-purple-500',
  listiges:   'bg-emerald-500',
  starkes:    'bg-slate-800',
  freches:    'bg-pink-500',
};

/** Fallback-Farbe, falls ein Adjektiv nicht im Mapping enthalten ist. */
const FALLBACK_COLOR = 'bg-indigo-500';

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
 * Rendert ein farbiges Tier-Icon basierend auf dem generierten Schülernamen.
 * - Das **Adjektiv** bestimmt die Farbe (CSS-Hintergrund).
 * - Das **Tier** bestimmt das SVG-Icon (per CSS-Mask).
 *
 * Die SVGs müssen als einfarbige Silhouetten in `/public/animals/` liegen,
 * z.B. `/public/animals/koala.svg`.
 */
export const AnimalAvatar = ({ studentName, className = '' }: AnimalAvatarProps) => {
  const { colorClass, svgPath } = useMemo(() => {
    const { adjective, animal } = parseStudentName(studentName);

    // Adjektiv → Farbe (case-insensitive Lookup)
    const color = ADJECTIVE_COLOR_MAP[adjective.toLowerCase()] ?? FALLBACK_COLOR;

    // Tier → SVG-Pfad über Dateinamen-Konvertierung
    const fileName = toFileName(animal);
    const path = `/animals/${fileName}.svg`;

    return { colorClass: color, svgPath: path };
  }, [studentName]);

  return (
    <div
      className={`${colorClass} ${className}`}
      style={{
        WebkitMaskImage: `url(${svgPath})`,
        maskImage: `url(${svgPath})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
      role="img"
      aria-label={studentName}
    />
  );
};
