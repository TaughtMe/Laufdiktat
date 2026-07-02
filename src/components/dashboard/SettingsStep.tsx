import { Check, PersonStanding, Headphones, Swords, MapPin, Minus, Plus } from 'lucide-react';
import type { BattleOptions, GameMode } from '../../types/game';

type ModeId = GameMode | 'STATION';

interface SettingsStepProps {
  gameMode: GameMode;
  stationMode: boolean;
  onSelectMode: (id: ModeId) => void;
  isTtsEnabled: boolean;
  onToggleTts: () => void;
  uebungMaxAttempts: number;
  onChangeAttempts: (n: number) => void;
  battleOptions: BattleOptions;
  onSetBattleOptions: (patch: Partial<BattleOptions>) => void;
  stationCount: number;
  onChangeStationCount: (n: number) => void;
  showStars: boolean;
  onToggleStars: (checked: boolean) => void;
}

const MODES: Array<{
  id: ModeId;
  title: string;
  sub: string;
  Icon: typeof PersonStanding;
  /** Farbklassen für das Icon-Quadrat (unausgewählt: soft-Hintergrund + kräftige Farbe). */
  softBg: string;
  strongBg: string;
  strongText: string;
}> = [
  { id: 'LAUFDIKTAT', title: 'Laufdiktat', sub: '2-Finger-Touch zum Einprägen, dann tippen.', Icon: PersonStanding, softBg: 'bg-accent-soft', strongBg: 'bg-accent-strong', strongText: 'text-accent-strong' },
  { id: 'UEBUNG', title: 'Freie Übung', sub: 'Vorlesen & gestufte Buchstaben-Hilfe.', Icon: Headphones, softBg: 'bg-viol-soft', strongBg: 'bg-viol', strongText: 'text-viol' },
  { id: 'BATTLE', title: 'Battle-Modus', sub: 'Gegeneinander, mit Störangriffen.', Icon: Swords, softBg: 'bg-warn-soft', strongBg: 'bg-warn', strongText: 'text-warn' },
  { id: 'STATION', title: 'Stationen', sub: 'Ohne eigenes Gerät, an nummerierten Stationen.', Icon: MapPin, softBg: 'bg-ok-soft', strongBg: 'bg-ok', strongText: 'text-ok' },
];

/** Schalter im Design-Stil: 40×23-Pille mit weißem Knopf. */
const Toggle = ({ on, onClick, onColor = 'bg-accent' }: { on: boolean; onClick: () => void; onColor?: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onClick}
    className={`relative w-10 h-[23px] rounded-full shrink-0 cursor-pointer transition-colors ${on ? onColor : 'bg-line'}`}
  >
    <span
      className={`absolute top-0.5 w-[19px] h-[19px] rounded-full bg-white shadow-sm transition-all ${on ? 'left-[19px]' : 'left-0.5'}`}
    />
  </button>
);

/** Kleiner −/+-Stepper im Design-Stil (26-px-Quadrate). */
const MiniStepper = ({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) => (
  <div className="flex items-center gap-2.5 shrink-0">
    <button
      type="button"
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      className="w-[26px] h-[26px] flex items-center justify-center bg-surface border border-line rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-ink"
      aria-label="Weniger"
    >
      <Minus className="w-3.5 h-3.5" />
    </button>
    <span className="text-[13px] font-extrabold min-w-[24px] text-center text-ink">{value}</span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      className="w-[26px] h-[26px] flex items-center justify-center bg-surface border border-line rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-ink"
      aria-label="Mehr"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  </div>
);

/** Options-Zeile: Titel + Beschreibung links, Steuerung rechts. */
const OptionRow = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between bg-surface-2 px-3.5 py-3 rounded-xl gap-3">
    <div className="min-w-0">
      <div className="text-[13px] font-bold text-ink">{title}</div>
      <div className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">{desc}</div>
    </div>
    {children}
  </div>
);

/**
 * Schritt 2 nach dem Redesign: links gestapelte Mode-Karten (farbiges
 * Icon-Quadrat, Check-Kreis; Auswahl = Accent-Rand + getönter Hintergrund),
 * rechts das Options-Panel für den gewählten Modus.
 */
export const SettingsStep = ({
  gameMode,
  stationMode,
  onSelectMode,
  isTtsEnabled,
  onToggleTts,
  uebungMaxAttempts,
  onChangeAttempts,
  battleOptions,
  onSetBattleOptions,
  stationCount,
  onChangeStationCount,
  showStars,
  onToggleStars,
}: SettingsStepProps) => {
  const selected: ModeId = stationMode ? 'STATION' : gameMode;

  const starsRow = (
    <OptionRow title="Sterne für Schüler" desc="Zeigt am Ende eine kleine Erfolgs-Belohnung.">
      <Toggle on={showStars} onClick={() => onToggleStars(!showStars)} />
    </OptionRow>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-7 flex-1 min-h-0">
      {/* Mode-Karten */}
      <div role="radiogroup" aria-label="Modus wählen" className="grid gap-3 pt-2.5 content-start">
        {MODES.map(({ id, title, sub, Icon, softBg, strongBg, strongText }) => {
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectMode(id)}
              className={`w-full min-h-[88px] border-2 rounded-[22px] grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 text-left cursor-pointer transition-all hover:shadow-[0_10px_26px_rgba(15,23,42,0.10)] ${
                isSelected ? 'bg-accent-soft border-accent' : 'bg-surface border-card-line'
              }`}
            >
              <div
                className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? `${strongBg} text-white` : `${softBg} ${strongText}`
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[15.5px] font-extrabold text-ink leading-tight">{title}</div>
                <div className="text-[12.5px] text-ink-muted mt-1 leading-snug">{sub}</div>
              </div>
              <div
                className={`w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center border-2 transition-colors ${
                  isSelected ? 'bg-accent border-accent' : 'bg-transparent border-card-line'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Options-Panel */}
      <div className="flex flex-col gap-2.5 min-h-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint pt-2.5">
          Optionen für {MODES.find((m) => m.id === selected)?.title}
        </span>
        <div className="bg-surface border border-line rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-[18px] flex flex-col justify-center gap-2.5 flex-1">
          {selected === 'UEBUNG' && (
            <>
              <OptionRow title="Vorlesen (Ton)" desc="Wort vorlesen lassen – zählt als Spicker.">
                <Toggle on={isTtsEnabled} onClick={onToggleTts} onColor="bg-viol" />
              </OptionRow>
              <OptionRow title="Fehlversuche bis Lösung" desc="Danach wird das Wort automatisch aufgelöst.">
                <MiniStepper value={uebungMaxAttempts} onChange={onChangeAttempts} min={1} max={10} />
              </OptionRow>
            </>
          )}

          {selected === 'BATTLE' && (
            <>
              <OptionRow title="Tintenfleck-Angriff" desc="Zufällige Tintenflecke verdecken die Sicht.">
                <Toggle on={battleOptions.ink} onClick={() => onSetBattleOptions({ ink: !battleOptions.ink })} onColor="bg-warn" />
              </OptionRow>
              <OptionRow title="Flimmern-Angriff" desc="Bildschirm flimmert beim Einprägen.">
                <Toggle on={battleOptions.flicker} onClick={() => onSetBattleOptions({ flicker: !battleOptions.flicker })} onColor="bg-warn" />
              </OptionRow>
            </>
          )}

          {selected === 'STATION' && (
            <>
              <OptionRow title="Anzahl Stationen" desc="Jede Station bekommt einen eigenen Code.">
                <MiniStepper value={stationCount} onChange={onChangeStationCount} min={1} max={100} />
              </OptionRow>
              <OptionRow title="Vorlesen (Ton)" desc="Wort vorlesen lassen – zählt als Spicker.">
                <Toggle on={isTtsEnabled} onClick={onToggleTts} onColor="bg-ok" />
              </OptionRow>
            </>
          )}

          {starsRow}
        </div>
      </div>
    </div>
  );
};
