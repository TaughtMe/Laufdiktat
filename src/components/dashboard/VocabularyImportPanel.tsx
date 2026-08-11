import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import type { useVocabularyImport } from '../../hooks/dashboard/useVocabularyImport';
import { VOCABULARY_LANGUAGES } from '../../hooks/dashboard/useVocabularyImport';

interface Props { vocabulary: ReturnType<typeof useVocabularyImport> }

const alternativesToText = (values: string[]) => values.join(' | ');
const textToAlternatives = (value: string) => value.split('|').map((part) => part.trim()).filter(Boolean);

export const VocabularyImportPanel = ({ vocabulary }: Props) => {
  const languageSelect = (value: string, onChange: (language: (typeof VOCABULARY_LANGUAGES)[number]) => void) => (
    <select
      value={value}
      onChange={(event) => {
        const language = VOCABULARY_LANGUAGES.find((entry) => entry.speechCode === event.target.value);
        if (language) onChange(language);
      }}
      className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink outline-none focus:border-accent"
    >
      {VOCABULARY_LANGUAGES.map((language) => (
        <option key={language.speechCode} value={language.speechCode}>{language.label}</option>
      ))}
    </select>
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      <section className="min-h-0 rounded-[18px] border border-line bg-surface-2 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-ink">Vokabelheft</h2>
            <p className="text-xs text-ink-faint">Weitere richtige Antworten mit | trennen.</p>
          </div>
          <span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent-strong">{vocabulary.validCount} Vokabeln</span>
        </div>

        <div className="mb-2 grid grid-cols-[1fr_1fr_40px] gap-3 px-1">
          {languageSelect(vocabulary.leftLanguage.speechCode, vocabulary.setLeftLanguage)}
          {languageSelect(vocabulary.rightLanguage.speechCode, vocabulary.setRightLanguage)}
          <span />
        </div>

        <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
          {vocabulary.pairs.map((pair, index) => (
            <div key={pair.id} className="grid grid-cols-[1fr_1fr_40px] gap-3 rounded-2xl border border-line bg-surface p-3">
              {(['left', 'right'] as const).map((side) => (
                <div key={side} className="min-w-0 space-y-2">
                  <input
                    value={pair[side].primary}
                    onChange={(event) => vocabulary.updatePair(pair.id, side, { primary: event.target.value })}
                    placeholder={side === 'left' ? `Vokabel ${index + 1}` : 'Übersetzung'}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-accent"
                  />
                  <input
                    defaultValue={alternativesToText(pair[side].alternatives)}
                    onBlur={(event) => vocabulary.updatePair(pair.id, side, { alternatives: textToAlternatives(event.target.value) })}
                    placeholder="Weitere Antworten: … | …"
                    className="w-full rounded-xl border border-dashed border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted outline-none focus:border-accent"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => vocabulary.removePair(pair.id)}
                aria-label={`Vokabel ${index + 1} löschen`}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink-faint hover:bg-danger-soft hover:text-danger"
              ><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>

        <button type="button" onClick={vocabulary.addPair} className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink-muted hover:bg-surface-2">
          <Plus className="h-4 w-4" /> Vokabel hinzufügen
        </button>
      </section>

      <aside className="space-y-4 rounded-[18px] border border-line bg-surface-2 p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-ink"><ArrowLeftRight className="h-4 w-4" /> Abfragerichtung</h3>
          <div className="mt-3 space-y-2">
            {[
              ['left-to-right', `${vocabulary.leftLanguage.label} → ${vocabulary.rightLanguage.label}`],
              ['right-to-left', `${vocabulary.rightLanguage.label} → ${vocabulary.leftLanguage.label}`],
              ['mixed', 'Beide Richtungen gemischt'],
            ].map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink">
                <input type="radio" name="vocabulary-direction" checked={vocabulary.direction === value} onChange={() => vocabulary.setDirection(value as typeof vocabulary.direction)} className="accent-accent" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-3">
          <input type="checkbox" checked={vocabulary.caseSensitive} onChange={(event) => vocabulary.setCaseSensitive(event.target.checked)} className="mt-0.5 accent-accent" />
          <span>
            <span className="block text-sm font-bold text-ink">Groß-/Kleinschreibung prüfen</span>
            <span className="block text-xs text-ink-faint">Standardmäßig aus, damit Handytastaturen nicht stören.</span>
          </span>
        </label>

        <div className="border-t border-line pt-4">
          <h3 className="text-sm font-extrabold text-ink">Tabelle einfügen</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">Zwei Spalten aus Excel/Sheets kopieren oder Semikolon verwenden. Alternativen mit | trennen.</p>
          <textarea value={vocabulary.tableInput} onChange={(event) => vocabulary.setTableInput(event.target.value)} placeholder={'Haus\thome | house\nBaum\ttree'} className="mt-3 h-28 w-full resize-none rounded-xl border border-line bg-surface p-3 text-xs text-ink outline-none focus:border-accent" />
          <button type="button" disabled={!vocabulary.tableInput.trim()} onClick={vocabulary.importTable} className="mt-2 w-full cursor-pointer rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Liste übernehmen</button>
        </div>
      </aside>
    </div>
  );
};
