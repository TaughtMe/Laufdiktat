import type { DragEvent } from 'react';
import { ChevronDown, ChevronUp, GripVertical, RotateCcw, X } from 'lucide-react';
import type { TextSection } from '../../utils/dashboard/textSections';

interface SectionManagerItemProps {
  section: TextSection;
  /** Position im fertigen Laufdiktat; null, wenn der Abschnitt ausgeschlossen ist. */
  displayNumber: number | null;
  isExcluded: boolean;
  isFirst: boolean;
  isLast: boolean;
  isDragTarget: boolean;
  onToggleExclude: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (e: DragEvent<HTMLLIElement>) => void;
  onDragOver: (e: DragEvent<HTMLLIElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

/**
 * Eine Zeile der Abschnittsverwaltung. Umsortieren geht per Ziehen UND über die
 * Hoch/Runter-Schaltflächen – letztere sind kein Beiwerk: HTML5-Drag-and-drop
 * funktioniert auf iPads nicht, und genau dort wird das Dashboard bedient.
 */
export const SectionManagerItem = ({
  section,
  displayNumber,
  isExcluded,
  isFirst,
  isLast,
  isDragTarget,
  onToggleExclude,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: SectionManagerItemProps) => (
  <li
    draggable
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    onDragEnd={onDragEnd}
    className={`flex items-center gap-2 rounded-[12px] border p-2 transition-colors ${
      isDragTarget ? 'border-accent ring-2 ring-accent' : 'border-line'
    } ${isExcluded ? 'bg-surface-2 opacity-55' : 'bg-surface'}`}
  >
    <span className="shrink-0 cursor-grab text-ink-faint active:cursor-grabbing" aria-hidden="true">
      <GripVertical className="h-4 w-4" />
    </span>

    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${
        isExcluded ? 'bg-surface text-ink-faint' : 'bg-accent-soft text-accent-strong'
      }`}
    >
      {displayNumber ?? '–'}
    </span>

    <span
      className={`min-w-0 flex-1 break-words text-[13px] leading-snug ${
        isExcluded ? 'text-ink-faint line-through' : 'text-ink'
      }`}
    >
      {section.text}
    </span>

    <span className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst}
        aria-label="Nach oben verschieben"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] text-ink-faint
          transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast}
        aria-label="Nach unten verschieben"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] text-ink-faint
          transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleExclude}
        aria-label={isExcluded ? 'Abschnitt wieder aufnehmen' : 'Abschnitt ausschließen'}
        title={
          isExcluded
            ? 'Wieder ins Laufdiktat aufnehmen'
            : 'Aus dem Laufdiktat ausschließen (der Text bleibt erhalten)'
        }
        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] transition-colors ${
          isExcluded
            ? 'text-ink-faint hover:bg-ok-soft hover:text-ok'
            : 'text-ink-faint hover:bg-danger/10 hover:text-danger'
        }`}
      >
        {isExcluded ? <RotateCcw className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </button>
    </span>
  </li>
);
