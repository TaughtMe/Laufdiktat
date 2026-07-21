import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Activity, Maximize2, X, XCircle } from 'lucide-react';
import { AnimalAvatar } from '../shared/AnimalAvatar';
import { RoomQrOverlay } from '../shared/RoomQrOverlay';

interface LobbyStepProps {
  roomCode: string;
  stationMode: boolean;
  /** Presence-basiert: wer ist JETZT GERADE verbunden (siehe useDashboardRoom.ts). */
  connectedStudents: string[];
  /** DB-basiert: wer ist im Raum REGISTRIERT (auch wenn gerade getrennt). */
  registeredStudents: string[];
  studentVersions: Record<string, string>;
  appVersion: string;
  connectionWarning: boolean;
  hadTwoConnections: boolean;
  /** Verbindung erneut aufbauen (öffnet den Realtime-Channel neu). */
  onRetry: () => void;
  /** Entfernt einen registrierten, aber getrennten Teilnehmer aus dem Raum. */
  onRemoveStudent: (name: string) => void;
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
  registeredStudents,
  studentVersions,
  appVersion,
  connectionWarning,
  hadTwoConnections,
  onRetry,
  onRemoveStudent,
}: LobbyStepProps) => {
  const [showLargeQrCode, setShowLargeQrCode] = useState(false);
  const joinUrl = `${window.location.origin}/?room=${roomCode}`;

  // Registriert-aber-getrennt (Standby, kurzer WLAN-Ausfall, Tab zu):
  // ausgegraut anzeigen statt kommentarlos verschwinden zu lassen -- so ist
  // sofort sichtbar, WELCHES Gerät fehlt, und die Zählung stimmt wieder mit
  // "alle Schüler haben sich angemeldet" überein. Die Presence-Liste kann der
  // DB-Liste kurz voraus sein (Debounce), daher die Vereinigung als Gesamtzahl.
  const connectedSet = new Set(connectedStudents);
  const disconnectedStudents = registeredStudents.filter((name) => !connectedSet.has(name));
  const totalCount = connectedStudents.length + disconnectedStudents.length;

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
          <span className="text-[13px] font-extrabold text-ink">
            {disconnectedStudents.length > 0
              ? `${connectedStudents.length} von ${totalCount} verbunden`
              : `${connectedStudents.length} verbunden`}
          </span>
        </div>

        {connectionWarning ? (
          <StatusPanel
            icon={<XCircle className="w-6 h-6 animate-pulse" />}
            tone="error"
            title="Server-Verbindung verloren"
            text="Die Echtzeit-Verbindung zum Server wurde unterbrochen. Bitte versuche es erneut."
            action={retryButton}
          />
        ) : hadTwoConnections && totalCount < 1 ? (
          <StatusPanel
            icon={<XCircle className="w-6 h-6 animate-bounce" />}
            tone="error"
            title="Verbindung abgebrochen"
            text="Ein zuvor verbundenes Gerät hat die Verbindung verloren."
            action={retryButton}
          />
        ) : totalCount < 1 ? (
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
            {/* Registriert, aber gerade getrennt (Standby/WLAN/Tab zu):
                ausgegraut mit Entfernen-Kreuz. Wacht das Gerät wieder auf,
                wandert die Karte automatisch zurück in den "Bereit"-Zustand. */}
            {disconnectedStudents.map((name) => (
              <div
                key={name}
                className="relative bg-surface-2 rounded-[14px] px-2 py-2.5 flex flex-col items-center gap-1 text-center opacity-55"
              >
                <button
                  type="button"
                  onClick={() => onRemoveStudent(name)}
                  aria-label={`${name} aus dem Raum entfernen`}
                  title="Aus dem Raum entfernen"
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-surface text-ink-faint hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" strokeWidth={3} />
                </button>
                <div className="w-10 h-10 rounded-[10px] bg-surface shadow-[inset_0_0_0_2px_var(--border)] flex items-center justify-center shrink-0 grayscale">
                  <AnimalAvatar studentName={name} className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-bold text-ink-muted whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  {name}
                </span>
                <span className="text-[9px] font-bold text-ink-faint">Getrennt</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLargeQrCode && (
        <RoomQrOverlay
          roomCode={roomCode}
          onClose={() => setShowLargeQrCode(false)}
          status={`${connectedStudents.length} Schüler verbunden`}
        />
      )}
    </div>
  );
};
