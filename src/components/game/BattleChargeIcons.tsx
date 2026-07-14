import type { AttackType } from '../../types/game';

/**
 * Battle-HUD als drei runde Icons (Tinte / Blitz / Schild) ohne Hintergrund.
 * Sie starten farblos (Graustufe) und füllen sich mit der gemeinsamen Ladung
 * (`charge` 0..100) von unten farbig auf – wie der frühere Aufladebalken.
 * Bei voller Ladung sind sie farbig und pulsieren leicht. Die Spiel-Mechanik
 * bleibt unverändert: eine geteilte Ladung schaltet alle drei gleichzeitig frei.
 */

const InkIcon = () => (
  <svg viewBox="0 0 48 48" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {/* Deckel */}
    <rect x="17" y="4" width="14" height="9" rx="2.5" fill="#7b5cf0" />
    {/* Hals */}
    <rect x="19.5" y="12" width="9" height="4.5" rx="1.5" fill="#5bc0f8" />
    {/* Flaschenkörper */}
    <rect x="9" y="17" width="30" height="26" rx="6" fill="#4aa8f0" />
    {/* Tinte */}
    <path d="M10 30 h28 v7 a6 6 0 0 1 -6 6 H16 a6 6 0 0 1 -6 -6 Z" fill="#1b3fca" />
    {/* Glanzlicht */}
    <rect x="13" y="21" width="3.5" height="13" rx="1.75" fill="#cfe9ff" opacity="0.85" />
    {/* Tropfen */}
    <path d="M42 33 c2.2 3.2 3.3 5 3.3 6.4 a3.3 3.3 0 0 1 -6.6 0 c0 -1.4 1.1 -3.2 3.3 -6.4 Z" fill="#1b3fca" />
  </svg>
);

const BoltIcon = () => (
  <svg viewBox="0 0 48 48" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {/* großer Blitz */}
    <path
      d="M30 4 L13 27 L22 27 L17 44 L35 21 L26 21 L30 4 Z"
      fill="#ffc224"
      stroke="#0b1f3a"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* kleiner Blitz */}
    <path
      d="M40 22 L31 34 L36 34 L33 44 L44 30 L38 30 L40 22 Z"
      fill="#ffc224"
      stroke="#0b1f3a"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 48 48" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {/* brauner Rand */}
    <path d="M24 4 L41 9 V22 C41 33 33.5 39.5 24 44 C14.5 39.5 7 33 7 22 V9 Z" fill="#6e4a2c" />
    {/* linke Hälfte (rot) */}
    <path d="M24 8 L10.5 12 V22 C10.5 31.5 17 37 24 41 Z" fill="#d8352c" />
    {/* rechte Hälfte (creme) */}
    <path d="M24 8 L37.5 12 V22 C37.5 31.5 31 37 24 41 Z" fill="#f2ead4" />
  </svg>
);

interface ChargeIconProps {
  fill: number; // 0..100
  ready: boolean; // voll aufgeladen und nutzbar
  active: boolean; // Sonderzustand (Schild hoch)
  disabled: boolean;
  ringColor: string;
  label: string;
  activeLabel: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

const ChargeIcon = ({ fill, ready, active, disabled, ringColor, label, activeLabel, onClick, children }: ChargeIconProps) => {
  const shown = active ? 100 : Math.max(0, Math.min(100, fill));
  const highlight = ready || active;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`relative w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full flex items-center justify-center transition-transform duration-300 ${
          ready ? 'animate-charge-pulse' : ''
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
        style={highlight ? { filter: `drop-shadow(0 0 9px ${ringColor}66)` } : undefined}
      >
        {/* runder Rahmen – blass, bis aufgeladen */}
        <span
          className="absolute inset-0 rounded-full border-2 transition-colors duration-300"
          style={{ borderColor: active ? '#5efcc2' : ready ? ringColor : 'rgba(255,255,255,0.14)' }}
        />
        {/* graue Basis (farblos) */}
        <span className="absolute inset-[19%] grayscale opacity-35">{children}</span>
        {/* farbige Füllung, von unten aufgedeckt */}
        <span
          className="absolute inset-[19%] transition-[clip-path] duration-500 ease-out"
          style={{ clipPath: `inset(${100 - shown}% 0 0 0)` }}
        >
          {children}
        </span>
      </button>
      <span
        className={`text-[10px] font-bold uppercase tracking-wide transition-colors ${
          highlight ? 'text-white' : 'text-slate-500'
        }`}
      >
        {active ? activeLabel : label}
      </span>
    </div>
  );
};

interface BattleChargeIconsProps {
  charge: number;
  chargeReady: boolean;
  shieldActive: boolean;
  availableAttacks: AttackType[];
  activeAttack: { type: AttackType } | null;
  onPickAttack: (type: AttackType) => void;
  onRaiseShield: () => void;
}

export const BattleChargeIcons = ({
  charge,
  chargeReady,
  shieldActive,
  availableAttacks,
  activeAttack,
  onPickAttack,
  onRaiseShield,
}: BattleChargeIconsProps) => (
  <div className="z-20 shrink-0 pb-2">
    <div className="flex items-start justify-center gap-6 sm:gap-9">
      {availableAttacks.includes('ink') && (
        <ChargeIcon
          fill={charge}
          ready={chargeReady}
          active={false}
          disabled={!chargeReady}
          ringColor="#4aa8f0"
          label="Tinte"
          activeLabel="Tinte"
          onClick={(e) => { e.stopPropagation(); onPickAttack('ink'); }}
        >
          <InkIcon />
        </ChargeIcon>
      )}

      {availableAttacks.includes('flicker') && (
        <ChargeIcon
          fill={charge}
          ready={chargeReady}
          active={false}
          disabled={!chargeReady}
          ringColor="#ffc224"
          label="Flimmern"
          activeLabel="Flimmern"
          onClick={(e) => { e.stopPropagation(); onPickAttack('flicker'); }}
        >
          <BoltIcon />
        </ChargeIcon>
      )}

      <ChargeIcon
        fill={charge}
        ready={chargeReady && !shieldActive}
        active={shieldActive}
        disabled={!chargeReady || shieldActive}
        ringColor="#d8352c"
        label="Schild"
        activeLabel="aktiv"
        onClick={(e) => { e.stopPropagation(); onRaiseShield(); }}
      >
        <ShieldIcon />
      </ChargeIcon>
    </div>

    {/* Statusanzeige bei eingehendem Angriff */}
    {activeAttack && (
      <div className="text-center text-[11px] font-bold text-red-300 animate-pulse mt-2">
        {activeAttack.type === 'ink' ? 'Tinten-Angriff aktiv!' : 'Flimmer-Angriff aktiv!'}
      </div>
    )}
  </div>
);
