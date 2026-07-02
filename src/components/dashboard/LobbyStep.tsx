import { QRCodeSVG } from 'qrcode.react';
import { Activity, XCircle } from 'lucide-react';
import { AnimalAvatar } from '../shared/AnimalAvatar';

interface LobbyStepProps {
  roomCode: string;
  stationMode: boolean;
  studentsInLobby: string[];
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
 * Badges pro Schüler bleiben vollständig erhalten.
 */
export const LobbyStep = ({
  roomCode,
  stationMode,
  studentsInLobby,
  studentVersions,
  appVersion,
  connectionWarning,
  hadTwoConnections,
  onRetry,
}: LobbyStepProps) => {
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
        <div className="bg-surface border border-line rounded-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-[18px] flex flex-col items-center gap-2.5">
          <div className="w-full aspect-square rounded-[14px] bg-white border border-line flex items-center justify-center p-2">
            <QRCodeSVG
              value={`${window.location.origin}/?room=${roomCode}`}
              size={160}
              level="H"
              className="w-full h-full"
            />
          </div>
          <span className="text-xs font-bold text-ink text-center leading-snug">Mit Schülergerät scannen</span>
        </div>
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
          <span className="text-[13px] font-extrabold text-ink">{studentsInLobby.length} verbunden</span>
        </div>

        {connectionWarning ? (
          <StatusPanel
            icon={<XCircle className="w-6 h-6 animate-pulse" />}
            tone="error"
            title="Server-Verbindung verloren"
            text="Die Echtzeit-Verbindung zum Server wurde unterbrochen. Bitte versuche es erneut."
            action={retryButton}
          />
        ) : hadTwoConnections && studentsInLobby.length < 1 ? (
          <StatusPanel
            icon={<XCircle className="w-6 h-6 animate-bounce" />}
            tone="error"
            title="Verbindung abgebrochen"
            text="Ein zuvor verbundenes Gerät hat die Verbindung verloren."
            action={retryButton}
          />
        ) : studentsInLobby.length < 1 ? (
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
            {studentsInLobby.map((name) => {
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
    </div>
  );
};
