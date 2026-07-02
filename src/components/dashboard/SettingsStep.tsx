import { Check, PersonStanding, Headphones, Swords, MapPin } from 'lucide-react';
import { MiniStepper } from './MiniStepper';
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
  /** Kurzbeschreibung in der Kartenliste links. */
  sub: string;
  /** Längere Beschreibung im Detail-Panel rechts. */
  description: string;
  /** Drei kurze Ablauf-Schritte fürs Detail-Panel. */
  ablauf: [string, string, string];
  Icon: typeof PersonStanding;
  /** Farbklassen für das Icon-Quadrat (unausgewählt: soft-Hintergrund + kräftige Farbe). */
  softBg: string;
  strongBg: string;
  strongText: string;
}> = [
  {
    id: 'LAUFDIKTAT',
    title: 'Laufdiktat',
    sub: '2-Finger-Touch zum Einprägen, dann tippen.',
    description: 'Klassischer Ablauf: Schüler prägen sich den Abschnitt ein und tippen ihn danach ab.',
    ablauf: ['Abschnitt einprägen', 'Zum Schreibfeld wechseln', 'Eingabe prüfen & bewerten'],
    Icon: PersonStanding,
    softBg: 'bg-accent-soft', strongBg: 'bg-accent-strong', strongText: 'text-accent-strong',
  },
  {
    id: 'UEBUNG',
    title: 'Freie Übung',
    sub: 'Vorlesen & gestufte Buchstaben-Hilfe.',
    description: 'Ruhiger Übungsmodus am Platz: Schüler hören sich das Wort an und tippen es mit gestufter Hilfe ein.',
    ablauf: ['Wort anhören', 'Wort eintippen', 'Bei Fehler Buchstaben-Hilfe nutzen'],
    Icon: Headphones,
    softBg: 'bg-viol-soft', strongBg: 'bg-viol', strongText: 'text-viol',
  },
  {
    id: 'BATTLE',
    title: 'Battle-Modus',
    sub: 'Gegeneinander, mit Störangriffen.',
    description: 'Zwei Schüler tippen denselben Text gegeneinander und bremsen sich mit Störangriffen aus.',
    ablauf: ['Beide starten gleichzeitig', 'Text abtippen & Angriffe einsetzen', 'Wer zuerst fertig ist, gewinnt'],
    Icon: Swords,
    softBg: 'bg-warn-soft', strongBg: 'bg-warn', strongText: 'text-warn',
  },
  {
    id: 'STATION',
    title: 'Stationen',
    sub: 'Ohne eigenes Gerät, an nummerierten Stationen.',
    description: 'Ohne eigenes Gerät: Der Text hängt an nummerierten Stationen im Raum aus.',
    ablauf: ['Zur Station laufen', 'Abschnitt lesen & merken', 'Am Gerät eintippen'],
    Icon: MapPin,
    softBg: 'bg-ok-soft', strongBg: 'bg-ok', strongText: 'text-ok',
  },
];

/** Farbiges Icon-Quadrat – im Detail-Panel-Header immer in der "kräftigen" Variante. */
const IconSquare = ({ mode, size = 52 }: { mode: (typeof MODES)[number]; size?: number }) => (
  <div
    className={`rounded-2xl flex items-center justify-center shrink-0 ${mode.strongBg} text-white`}
    style={{ width: size, height: size }}
  >
    <mode.Icon className={size >= 52 ? 'w-6 h-6' : 'w-5 h-5'} />
  </div>
);

/** Kleines Kästchen-Kontrollkästchen im Design-Stil (statt Schalter-Pille). */
const Checkbox = ({
  checked,
  onClick,
  colorClass = 'bg-accent border-accent',
}: {
  checked: boolean;
  onClick: () => void;
  colorClass?: string;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={onClick}
    className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
      checked ? colorClass : 'bg-transparent border-line'
    }`}
  >
    {checked && <Check className="w-3 h-3 text-white stroke-[4]" />}
  </button>
);

/** Options-Zeile mit Checkbox (Ja/Nein-Optionen). */
const CheckboxRow = ({
  label,
  checked,
  onClick,
  colorClass,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
  colorClass?: string;
}) => (
  <label className="flex items-center gap-3 cursor-pointer" onClick={(e) => { e.preventDefault(); onClick(); }}>
    <Checkbox checked={checked} onClick={onClick} colorClass={colorClass} />
    <span className="text-sm font-semibold text-ink">{label}</span>
  </label>
);

/** Options-Zeile mit Stepper (numerische Optionen). */
const StepperRow = ({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-sm font-semibold text-ink">{label}</span>
    <MiniStepper value={value} onChange={onChange} min={min} max={max} />
  </div>
);

/**
 * Schritt 2 nach dem Redesign: links gestapelte Mode-Karten (Icon-Quadrat in
 * eigener Modus-Farbe, Auswahl = voll gefüllte Accent-Karte mit weißer
 * Schrift + invertiertem Check-Kreis), rechts ein Detail-Panel zum gewählten
 * Modus: Icon + Titel, Beschreibung, "Ablauf" mit drei nummerierten Schritten,
 * Trennlinie, "Optionen" mit Checkbox-/Stepper-Zeilen.
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
  const activeMode = MODES.find((m) => m.id === selected)!;

  const starsRow = (
    <CheckboxRow label="Sterne für Schüler anzeigen" checked={showStars} onClick={() => onToggleStars(!showStars)} />
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-7 flex-1 min-h-0">
      {/* Mode-Karten */}
      <div role="radiogroup" aria-label="Modus wählen" className="grid gap-3 pt-2.5 content-start">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint px-1">Spielmodus wählen</span>
        {MODES.map((mode) => {
          const { id, title, sub, Icon, softBg, strongBg, strongText } = mode;
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectMode(id)}
              className={`w-full min-h-[88px] border-2 rounded-[22px] grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 text-left cursor-pointer transition-all hover:shadow-[0_10px_26px_rgba(15,23,42,0.10)] ${
                isSelected ? 'bg-accent border-accent' : 'bg-surface border-card-line'
              }`}
            >
              <div
                className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0 ${
                  isSelected ? `${strongBg} text-white` : `${softBg} ${strongText}`
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className={`text-[15.5px] font-extrabold leading-tight ${isSelected ? 'text-white' : 'text-ink'}`}>
                  {title}
                </div>
                <div className={`text-[12.5px] mt-1 leading-snug ${isSelected ? 'text-white/80' : 'text-ink-muted'}`}>
                  {sub}
                </div>
              </div>
              <div
                className={`w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center border-2 transition-colors ${
                  isSelected ? 'bg-white border-white' : 'bg-transparent border-card-line'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-accent-strong stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail-Panel */}
      <div className="bg-surface border border-line rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 flex flex-col gap-5 min-h-0 mt-[38px] overflow-y-auto">
        <div className="flex items-center gap-4">
          <IconSquare mode={activeMode} />
          <h3 className="text-2xl font-extrabold text-ink leading-tight">{activeMode.title}</h3>
        </div>

        <p className="text-[15px] text-ink-muted leading-relaxed">{activeMode.description}</p>

        <div>
          <h4 className="text-base font-extrabold text-ink mb-3">Ablauf</h4>
          <ol className="flex flex-col gap-2.5">
            {activeMode.ablauf.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-accent-soft text-accent-strong text-xs font-extrabold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <hr className="border-line" />

        <div>
          <h4 className="text-base font-extrabold text-ink mb-3">Optionen</h4>
          <div className="flex flex-col gap-3.5">
            {selected === 'UEBUNG' && (
              <>
                <CheckboxRow label="Vorlesen (Ton)" checked={isTtsEnabled} onClick={onToggleTts} colorClass="bg-viol border-viol" />
                <StepperRow label="Fehlversuche bis Lösung" value={uebungMaxAttempts} onChange={onChangeAttempts} min={1} max={10} />
              </>
            )}

            {selected === 'BATTLE' && (
              <>
                <CheckboxRow
                  label="Tintenfleck-Angriff"
                  checked={battleOptions.ink}
                  onClick={() => onSetBattleOptions({ ink: !battleOptions.ink })}
                  colorClass="bg-warn border-warn"
                />
                <CheckboxRow
                  label="Flimmern-Angriff"
                  checked={battleOptions.flicker}
                  onClick={() => onSetBattleOptions({ flicker: !battleOptions.flicker })}
                  colorClass="bg-warn border-warn"
                />
              </>
            )}

            {selected === 'STATION' && (
              <StepperRow label="Anzahl Stationen" value={stationCount} onChange={onChangeStationCount} min={1} max={100} />
            )}

            {starsRow}
          </div>
        </div>
      </div>
    </div>
  );
};
