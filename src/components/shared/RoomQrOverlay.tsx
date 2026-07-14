import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';

interface RoomQrOverlayProps {
  roomCode: string;
  onClose: () => void;
  /** Optionale Statuszeile unter dem Code (z. B. "3 Schüler angemeldet"). */
  status?: string;
}

/**
 * Vollbild-Dialog mit großem QR-Code + Raum-Code zum (erneuten) Beitreten.
 * Gemeinsam genutzt von der Lobby (LobbyStep) und der Live-Sitzung
 * (WizardFooter → FooterRoomCode), damit beide Stellen exakt dieselbe
 * Beitritts-Ansicht zeigen. Der QR-Code kodiert dieselbe Join-URL wie die
 * Lobby (window.location.origin + ?room=CODE).
 */
export const RoomQrOverlay = ({ roomCode, onClose, status }: RoomQrOverlayProps) => {
  const joinUrl = `${window.location.origin}/?room=${roomCode}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-5 cursor-default"
      role="dialog"
      aria-modal="true"
      aria-label="Vergrößerter QR-Code für den Raumbeitritt"
      onClick={onClose}
    >
      <div
        className="relative bg-surface rounded-[28px] shadow-2xl p-5 sm:p-7 flex flex-col items-center gap-4 max-h-[94dvh] cursor-default"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-surface-2 hover:bg-line text-ink-muted hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Großen QR-Code schließen"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="bg-white rounded-[20px] p-3 sm:p-4 mt-7">
          <QRCodeSVG
            value={joinUrl}
            size={520}
            level="H"
            className="w-[min(68vw,58vh,520px)] h-[min(68vw,58vh,520px)]"
          />
        </div>

        <div className="text-center">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
            Raum-Code
          </div>
          <div className="font-mono font-extrabold text-3xl sm:text-4xl tracking-[0.16em] text-accent-strong mt-1 pl-[0.16em]">
            {roomCode}
          </div>
        </div>

        {status && (
          <div className="flex items-center gap-2 bg-ok-soft text-ok rounded-full px-4 py-2 text-sm sm:text-base font-extrabold">
            <span className="w-2 h-2 rounded-full bg-ok" />
            {status}
          </div>
        )}

        <p className="text-[11px] text-ink-muted text-center">
          Neben den QR-Code tippen zum Schließen.
        </p>
      </div>
    </div>
  );
};
