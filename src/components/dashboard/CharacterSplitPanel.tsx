import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { TextSplitConfig } from '../../utils/dashboard/textSections';

/**
 * Nur die vier alltäglichen Satzzeichen als Chips. Alles Weitere (; : … –) ist
 * selten genug, dass es über „Eigener Trenner" eingegeben werden kann, statt die
 * Reihe dauerhaft zu verlängern.
 */
const COMMON_PUNCTUATION = ['.', ',', '!', '?'];

interface CharacterSplitPanelProps {
  config: TextSplitConfig;
  onChange: (config: TextSplitConfig) => void;
}

/**
 * Dauerhaft sichtbares Panel der Regel „Zeichen": Satzzeichen-Chips und eigene
 * Trenner. Verändert ausschließlich die TextSplitConfig – die Aufteilung selbst
 * macht buildTextSections.
 *
 * Das Ausgrauen bei inaktiver Regel passiert im umgebenden <fieldset> (siehe
 * TextImportPanel); dort werden die Bedienelemente auch nativ deaktiviert.
 */
export const CharacterSplitPanel = ({ config, onChange }: CharacterSplitPanelProps) => {
  const [draft, setDraft] = useState('');

  // Zeichen, die früher Chips waren (oder aus einer gespeicherten Konfiguration
  // stammen) und noch aktiv sind, bekommen weiter einen Chip – sonst ließen sie
  // sich nicht mehr abwählen.
  const chips = [...COMMON_PUNCTUATION, ...config.punctuation.filter((c) => !COMMON_PUNCTUATION.includes(c))];

  const togglePunctuation = (ch: string) => {
    const has = config.punctuation.includes(ch);
    onChange({
      ...config,
      punctuation: has ? config.punctuation.filter((c) => c !== ch) : [...config.punctuation, ch],
    });
  };

  const addDelimiter = () => {
    const value = draft.trim();
    if (!value) return;
    // Doppelte stillschweigend übergehen – ein zweiter identischer Trenner
    // hätte keine Wirkung, würde aber als eigener Chip erscheinen.
    if (config.customDelimiters.some((d) => d.value === value)) {
      setDraft('');
      return;
    }
    onChange({
      ...config,
      customDelimiters: [...config.customDelimiters, { id: crypto.randomUUID(), value }],
    });
    setDraft('');
  };

  const removeDelimiter = (id: string) =>
    onChange({ ...config, customDelimiters: config.customDelimiters.filter((d) => d.id !== id) });

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-ink-muted">
        Trennen nach Zeichen
      </span>

      <div className="flex flex-wrap gap-1.5">
        {chips.map((ch) => {
          const active = config.punctuation.includes(ch);
          return (
            <button
              key={ch}
              type="button"
              onClick={() => togglePunctuation(ch)}
              aria-pressed={active}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] border-2 text-[17px] font-bold transition-colors ${
                active
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-line bg-surface text-ink-faint hover:text-ink'
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>

      {/* h-10 und border-2 wie die Zeichen-Chips darüber: die Zeile liest sich als
          Fortsetzung derselben Reihe, nicht als angehängtes Extra. */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDelimiter();
            }
          }}
          placeholder="Eigener Trenner …"
          className="h-10 min-w-0 flex-1 rounded-[10px] border-2 border-line bg-surface px-3 font-mono
            text-[13px] text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={addDelimiter}
          disabled={!draft.trim()}
          className="flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-[10px] border-2
            border-line bg-surface px-3 text-[12px] font-bold text-ink-muted transition-colors
            hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Hinzufügen</span>
        </button>
      </div>

      {config.customDelimiters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {config.customDelimiters.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => removeDelimiter(d.id)}
              title="Trenner entfernen"
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-surface px-2.5 py-1
                font-mono text-[11.5px] font-bold text-ink-muted transition-colors hover:text-danger"
            >
              <span className="break-all">{d.value}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
