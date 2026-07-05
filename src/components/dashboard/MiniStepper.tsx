import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * Kleiner −/+-Stepper im Design-Stil (26-px-Quadrate). Die Zahl ist jetzt ein
 * echtes Eingabefeld – Wert direkt eintippen statt zwingend über +/- klicken.
 * Tippen wird erst beim Verlassen des Felds (Blur/Enter) übernommen und dabei
 * auf min..max begrenzt; +/- wirken weiterhin sofort auf den aktuellen Wert.
 */
export const MiniStepper = ({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) => {
  const [text, setText] = useState(String(value));
  // Von außen geänderte (oder per +/- verstellte) Werte im Feld nachziehen –
  // bewusst während des Renderns statt in einem Effekt (React-empfohlenes
  // Muster "state adjustment during render", vermeidet einen Render-Frame
  // Verzögerung und den set-state-in-effect-Lint).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }

  const commit = () => {
    const n = parseInt(text, 10);
    const clamped = Number.isNaN(n) ? value : Math.min(max, Math.max(min, n));
    onChange(clamped);
    setText(String(clamped));
  };

  // Ziffern und ein optionales führendes Minus erlauben (für negative
  // Zahlenbereiche, z. B. Von=-20): Minus zählt nur, wenn es am Anfang
  // steht, alle anderen Zeichen (auch weitere Minuszeichen) fallen weg.
  const sanitize = (raw: string): string => {
    const negative = raw.trim().startsWith('-');
    const digits = raw.replace(/\D/g, '');
    return negative ? `-${digits}` : digits;
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-[26px] h-[26px] flex items-center justify-center bg-surface border border-line rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-ink shrink-0"
        aria-label="Weniger"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="text"
        inputMode={min < 0 ? 'text' : 'numeric'}
        pattern={min < 0 ? '-?[0-9]*' : '[0-9]*'}
        value={text}
        onChange={(e) => setText(sanitize(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="w-11 text-center text-[13px] font-extrabold text-ink bg-transparent focus:outline-none focus:ring-2 focus:ring-accent rounded-md py-0.5"
        aria-label="Wert eingeben"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-[26px] h-[26px] flex items-center justify-center bg-surface border border-line rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-ink shrink-0"
        aria-label="Mehr"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
