import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { VersionBadge } from '../shared/VersionBadge';
import { RoomQrOverlay } from '../shared/RoomQrOverlay';

interface WizardFooterProps {
  canBack: boolean;
  onBack: () => void;
  nextLabel: string;
  /** Farbcharakter des Primär-Buttons: Standard (accent), Start (ok), Beenden (danger). */
  nextVariant?: 'accent' | 'ok' | 'danger';
  nextDisabled?: boolean;
  onNext: () => void;
  /** Raum-Code der laufenden Sitzung (nur relevant, wenn showRoomCode gesetzt ist). */
  roomCode?: string;
  /** In der Live-Sitzung statt der Versionsnummer den klickbaren Raum-Code zeigen. */
  showRoomCode?: boolean;
}

const VARIANT_CLASS: Record<NonNullable<WizardFooterProps['nextVariant']>, string> = {
  accent: 'bg-accent hover:opacity-90',
  ok: 'bg-ok hover:opacity-90',
  danger: 'bg-danger hover:opacity-90',
};

/**
 * Klickbarer Raum-Code für die Live-Sitzung (mittig im Footer, wo sonst die
 * Versionsnummer steht). Ein Klick öffnet den großen QR-Code (RoomQrOverlay),
 * damit sich Nachzügler jederzeit erneut anmelden können – genau wie in der
 * Lobby.
 */
const FooterRoomCode = ({ roomCode }: { roomCode: string }) => {
  const [showQr, setShowQr] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShowQr(true)}
        aria-label="Raum-Code groß mit QR-Code anzeigen"
        className="group flex items-center gap-2.5 rounded-[14px] border border-line bg-surface-2 px-4 py-1.5 hover:border-accent/50 transition-colors cursor-pointer"
      >
        <div className="flex flex-col items-start leading-none">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">Raum-Code</span>
          <span className="font-mono text-xl font-extrabold tracking-[0.14em] text-ink mt-0.5">{roomCode}</span>
        </div>
        <QrCode className="w-5 h-5 text-ink-muted group-hover:text-accent-strong transition-colors" />
      </button>
      {showQr && <RoomQrOverlay roomCode={roomCode} onClose={() => setShowQr(false)} />}
    </>
  );
};

/**
 * Wizard-Fußzeile nach dem Redesign: links "← Zurück" (auf Schritt 1
 * unsichtbar, behält aber den Platz), rechts der kontextabhängige
 * Primär-Button ("Weiter zur Konfiguration" / "Lobby öffnen" /
 * "Diktat jetzt starten" / "Sitzung beenden").
 */
export const WizardFooter = ({
  canBack,
  onBack,
  nextLabel,
  nextVariant = 'accent',
  nextDisabled = false,
  onNext,
  roomCode,
  showRoomCode = false,
}: WizardFooterProps) => (
  <footer className="px-5 sm:px-9 py-4 border-t border-line bg-surface flex items-center justify-between gap-4 shrink-0">
    <button
      type="button"
      onClick={onBack}
      className={`flex items-center gap-2 text-sm font-bold px-6 py-3.5 rounded-[14px] min-w-[130px] justify-center transition-colors cursor-pointer ${
        canBack
          ? 'text-ink-muted bg-surface-2 hover:text-ink'
          : 'opacity-0 pointer-events-none'
      }`}
      tabIndex={canBack ? 0 : -1}
    >
      ← Zurück
    </button>
    {showRoomCode && roomCode ? <FooterRoomCode roomCode={roomCode} /> : <VersionBadge fixed={false} />}
    <button
      type="button"
      onClick={onNext}
      disabled={nextDisabled}
      className={`flex items-center gap-2 text-white text-[14.5px] font-extrabold px-7 py-3.5 rounded-[14px] w-full max-w-[260px] whitespace-nowrap justify-center transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${VARIANT_CLASS[nextVariant]}`}
    >
      {nextLabel} →
    </button>
  </footer>
);
