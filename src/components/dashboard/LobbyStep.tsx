import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Activity, Maximize2, X, XCircle } from 'lucide-react';
import { AnimalAvatar } from '../shared/AnimalAvatar';

interface LobbyStepProps {
  roomCode: string;
  stationMode: boolean;
  /** Presence-basiert: wer ist JETZT GERADE verbunden (siehe useDashboardRoom.ts). */
  connectedStudents: string[];
  studentVersions: Record<string, string>;
  appVersion: string;
  connectionWarning: boolean;
  hadTwoConnections: boolean;
  /** Verbindung erneut aufbauen (öffnet den Realtime-Channel neu). */
  onRetry: () => void;
}

/** Hinweis-Panel für Verbindungs-Zustände (Warten/Abbruch/Serverfehler). */
const StatusPanel = ({
  icon,
  tone,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  tone: 'wait' | 'error';
  title: string;
  text: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center text-center py-10 px-6 flex-1">
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
        tone === 'error' ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent-strong animate-pulse'
      }`}
    >
      {icon}
    </div>
    <h3 className="text-[15px] font-extrabold text-ink">{title}</h3>
    <p className="text-xs text-ink-muted mt-2 max-w-[300px] leading-relaxed">{text}</p>
    {action}
  </div>
);

/**
 * Schritt 3 nach dem Redesign: links QR-Karte + Raumcode-Karte in Accent-
 * Tönung, rechts die "N verbunden"-Karte mit dem Schülerkarten-Grid.
 * Verbindungszustände (Warten, Abbruch, Serverfehler) und die Versions-
 * Badges pro Schüler bleiben vollständig erhalten. connectedStudents kommt
 * jetzt aus Supabase Presence (siehe useDashboardRoom.ts) statt aus einem
 * nur wachsenden Broadcast-Log – "Verbindung abgebrochen" kann dadurch
 * erstmals tatsächlich auftreten, statt technisch unerreichbar zu sein.
 */
export const LobbyStep = ({
  roomCode,
  stationMode,
  connectedStudents,
  studentVersions,
  appVersion,
  connectionWarning,
  hadTwoConnections,
  onRetry,
}: LobbyStepProps) => {
  const [showLargeQrCode, setShowLargeQrCode] = useState(false);
  const studentCountLabel = `${connectedStudents.length} Schüler`;
  const joinUrl = `${window.location.origin}/?room=${roomCode}`;

  const retryButton = (
    <button
      type="button"
      onClick={onRetry}
      className="mt-5 px-5 py-2.5 bg-accent hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
    >
      Verbindung wiederherstellen
    </button>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5 flex-1 min-h-[420px] pt-2.5">
      {/* Linke Spalte: QR + Raumcode */}
      <div className="flex flex-col gap-3.5">
        <button
          type="button"
          onClick={() => setShowLargeQrCode(true)}
          aria-label="QR-Code groß anzeigen"
          className="group bg-surface border border-line rounded-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-[18px] flex flex-col items-center gap-2.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 focus-visible:border-accent active:translate-y-0 active:scale-[0.98]"
        >
          <div className="relative w-full aspect-square rounded-[14px] bg-white border border-line flex items-center justify-center p-2 overflow-hidden">
            <QRCodeSVG
              value={joinUrl}
              size={160}
              level="H"
              className="w-full h-full transition-transform duration-200 group-hover:scale-[1.025] group-focus-visible:scale-[1.025]"
            />
            <div className="absolute inset-0 bg-accent-strong/80 text-white flex flex-col items-center justify-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              <Maximize2 className="w-8 h-8" strokeWidth={2.25} />
              <span className="text-xs font-extrabold">Groß anzeigen</span>
            </div>
          </div>
          <span className="text-xs font-bold text-ink text-center leading-snug">Mit Schülergerät scannen</span>
          <span className="text-[10px] font-bold text-accent-strong">Zum Vergrößern anklicken</span>
        </button>
        <div className="bg-accent-soft rounded-[22px] p-4 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-accent-strong opacity-80">
            oder Raum-Code eingeben
          </div>
          <div className="font-mono font-extrabold text-[28px] tracking-[0.14em] text-accent-strong mt-0.5 pl-[0.14em]">
            {roomCode}
          </div>
        </div>
        {stationMode && (
          <div className="bg-ok-soft rounded-[14px] px-4 py-2.5 text-center text-xs font-bold text-ok">
            Stations-Modus aktiv
          </div>
        )}
      </div>

      {/* Rechte Spalte: verbundene Schüler */}
      <div className="bg-surface border border-line rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex flex-col gap-3.5 min-h-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className={`w-[7px] h-[7px] rounded-full ${connectionWarning ? 'bg-danger' : 'bg-ok'}`} />
          <span className="text-[13px] font-extrabold text-ink">{connectedStudents.length} verbunden</span>
        </div>

        {connectionWarning ? (
          <StatusPanel
            icon={<XCircle className="w-6 h-6 animate-pulse" />}
            tone="error"
            title="Server-Verbindung verloren"
            text="Die Echtzeit-Verbindung zum Server wurde unterbrochen. Bitte versuche es erneut."
            action={retryButton}
          />
        ) : hadTwoConnections && connectedStudents.length < 1 ? (
          <StatusPanel
            icon={<XCircle className="w-6 h-6 animate-bounce" />}
            tone="error"
            title="Verbindung abgebrochen"
            text="Ein zuvor verbundenes Gerät hat die Verbindung verloren."
            action={retryButton}
          />
        ) : connectedStudents.length < 1 ? (
          <StatusPanel
            icon={<Activity className="w-6 h-6" />}
            tone="wait"
            title="Warte auf Verbindung..."
            text={
              stationMode
                ? 'Stationen können auch ohne verbundene Geräte gestartet werden.'
                : 'Sobald mindestens ein Gerät verbunden ist, kannst du das Diktat starten.'
            }
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 overflow-y-auto content-start flex-1 min-h-0">
            {connectedStudents.map((name) => {
              const studentVersion = studentVersions[name];
              const versionOk = !studentVersion || studentVersion === appVersion;
              return (
                <div
                  key={name}
                  className="bg-surface-2 rounded-[14px] px-2 py-2.5 flex flex-col items-center gap-1 text-center"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-surface shadow-[inset_0_0_0_2px_var(--green)] flex items-center justify-center shrink-0">
                    <AnimalAvatar studentName={name} className="w-7 h-7" />
                  </div>
                  <span className="text-[11px] font-bold text-ink whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                    {name}
                  </span>
                  <span className="text-[9px] font-bold text-ok">Bereit</span>
                  {studentVersion && !versionOk && (
                    <span
                      className="text-[9px] font-bold text-warn bg-warn-soft px-1.5 py-0.5 rounded-full"
                      title={`Erwartet: v${appVersion}, Gerät hat v${studentVersion}`}
                    >
                      ⚠ Update nötig
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showLargeQrCode && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-5 cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          aria-label="Vergrößerter QR-Code für den Raumbeitritt"
          onClick={() => setShowLargeQrCode(false)}
        >
          <div
            className="relative bg-surface rounded-[28px] shadow-2xl p-5 sm:p-7 flex flex-col items-center gap-4 max-h-[94dvh] cursor-default"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowLargeQrCode(false)}
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

            <div className="flex items-center gap-2 bg-ok-soft text-ok rounded-full px-4 py-2 text-sm sm:text-base font-extrabold">
              <span className="w-2 h-2 rounded-full bg-ok" />
              {studentCountLabel} angemeldet
            </div>

            <p className="text-[11px] text-ink-muted text-center">
              Neben den QR-Code klicken, um zur Lobby zurückzukehren.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
