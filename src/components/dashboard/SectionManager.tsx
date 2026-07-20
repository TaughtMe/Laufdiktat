import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TextSection } from '../../utils/dashboard/textSections';
import { SectionManagerItem } from './SectionManagerItem';

/**
 * Position im fertigen Laufdiktat je Abschnitt; null für ausgeschlossene.
 * Bewusst außerhalb der Komponente: eine mitlaufende Zählvariable im
 * Render-Rumpf wäre eine Mutation während des Renderns.
 */
const computeDisplayNumbers = (
  sections: TextSection[],
  excluded: Set<string>
): Array<number | null> => {
  const numbers: Array<number | null> = [];
  let position = 0;
  for (const section of sections) {
    if (excluded.has(section.id)) {
      numbers.push(null);
      continue;
    }
    position += 1;
    numbers.push(position);
  }
  return numbers;
};

interface SectionManagerProps {
  /** Alle Abschnitte in der aktuellen Reihenfolge – ausgeschlossene INKLUSIVE. */
  orderedSections: TextSection[];
  excludedIds: string[];
  onToggleExclude: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRestoreAll: () => void;
  onClose: () => void;
}

/**
 * Optionale Verwaltung der Abschnitte – standardmäßig geschlossen, ersetzt die
 * frühere dauerhafte Chipliste.
 *
 * Wichtig: Ausschließen und Umsortieren wirken ausschließlich auf die fertige
 * WordItem-Liste. Der Rohtext wird hier nie angefasst; ausgeschlossene
 * Abschnitte bleiben sichtbar und lassen sich wieder aufnehmen.
 *
 * Auf großen Bildschirmen mittiger Dialog, auf schmalen ein von unten
 * einfahrendes Sheet.
 */
export const SectionManager = ({
  orderedSections,
  excludedIds,
  onToggleExclude,
  onReorder,
  onRestoreAll,
  onClose,
}: SectionManagerProps) => {
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const excluded = new Set(excludedIds);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Nummerierung entspricht der Position im fertigen Laufdiktat, überspringt
  // also ausgeschlossene Abschnitte.
  const numbers = computeDisplayNumbers(orderedSections, excluded);
  const activeCount = numbers.filter((n) => n !== null).length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Abschnitte verwalten"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-[22px] border border-line
          bg-surface shadow-2xl sm:max-h-[85vh] sm:rounded-[22px]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <h3 className="text-[16px] font-extrabold text-ink">Abschnitte verwalten</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
              Reihenfolge ändern oder einzelne Abschnitte ausschließen. Der eingegebene Text bleibt dabei
              unverändert.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full
              text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {orderedSections.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-faint">
              Noch keine Abschnitte. Gib zuerst Text ein.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {orderedSections.map((section, idx) => (
                <SectionManagerItem
                  key={section.id}
                  section={section}
                  displayNumber={numbers[idx]}
                  isExcluded={excluded.has(section.id)}
                  isFirst={idx === 0}
                  isLast={idx === orderedSections.length - 1}
                  isDragTarget={dragOverIdx === idx}
                  onToggleExclude={() => onToggleExclude(section.id)}
                  onMoveUp={() => onReorder(idx, idx - 1)}
                  onMoveDown={() => onReorder(idx, idx + 1)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(idx));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIdx(idx);
                  }}
                  onDragLeave={() => setDragOverIdx((cur) => (cur === idx ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverIdx(null);
                    const from = Number(e.dataTransfer.getData('text/plain'));
                    if (!Number.isNaN(from) && from !== idx) onReorder(from, idx);
                  }}
                  onDragEnd={() => setDragOverIdx(null)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line p-4">
          <span className="text-[12px] font-bold text-ink-muted">
            {activeCount} von {orderedSections.length} im Laufdiktat
          </span>
          {excludedIds.length > 0 && (
            <button
              type="button"
              onClick={onRestoreAll}
              className="cursor-pointer rounded-full px-3 py-2 text-[12px] font-bold text-ink-faint
                transition-colors hover:text-accent-strong"
            >
              Alle wieder aufnehmen
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
