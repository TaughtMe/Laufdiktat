import { Download } from 'lucide-react';
import { AnimalAvatar } from '../shared/AnimalAvatar';
import { computeStars } from '../../utils/game/scoring';
import type { StudentResult } from '../../hooks/dashboard/useDashboardRoom';
import type { StationStudentState } from '../../types/game';

interface LiveStepProps {
  roomCode: string;
  wordsCount: number;
  showStars: boolean;
  stationMode: boolean;
  stationCount: number;
  stationStates: Map<number, StationStudentState>;
  getStationStatus: (num: number) => 'idle' | 'active' | 'done';
  studentsInLobby: string[];
  results: StudentResult[];
  liveProgress: Record<string, number>;
  getStudentProgress: (name: string) => number;
  overallProgress: number;
  wordErrorRanking: Array<[string, number]>;
  onExportCSV: () => void;
  exportDisabled: boolean;
}

/** Stat-Karte oben: farbiger Punkt + Label + große Zahl. */
const StatCard = ({ dotClass, label, value }: { dotClass: string; label: string; value: string | number }) => (
  <div className="bg-surface border border-line rounded-[22px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
      <span className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.05em]">{label}</span>
    </div>
    <div className="text-[28px] font-extrabold text-ink mt-2">{value}</div>
  </div>
);

/**
 * Schritt 4 nach dem Redesign: Live-Kopfzeile mit Raum-Code, drei
 * Stat-Karten (Aktiv/Fertig/Gesamtfortschritt), Schüler-Grid mit
 * Fortschrittsbalken bzw. Fertig-Chips und das Häufigste-Fehler-Panel.
 * Stations-Modus zeigt Stationskarten statt Schülerkarten; der
 * CSV-Export bleibt erhalten.
 */
export const LiveStep = ({
  roomCode,
  wordsCount,
  showStars,
  stationMode,
  stationCount,
  stationStates,
  getStationStatus,
  studentsInLobby,
  results,
  liveProgress,
  getStudentProgress,
  overallProgress,
  wordErrorRanking,
  onExportCSV,
  exportDisabled,
}: LiveStepProps) => {
  const stationNums = Array.from({ length: stationCount }, (_, i) => i + 1);
  const activeCount = stationMode
    ? stationNums.filter((n) => getStationStatus(n) === 'active').length
    : Math.max(0, studentsInLobby.length - results.length);
  const finishedCount = stationMode
    ? stationNums.filter((n) => getStationStatus(n) === 'done').length
    : results.length;
  const overall = stationMode
    ? (stationCount === 0
        ? 0
        : Math.round(
            stationNums.reduce((acc, n) => {
              const status = getStationStatus(n);
              if (status === 'done') return acc + 100;
              const s = stationStates.get(n);
              return acc + (s && wordsCount > 0 ? Math.round(((s.currentIndex + 1) / wordsCount) * 100) : 0);
            }, 0) / stationCount
          ))
    : overallProgress;
  const maxErrorCount = wordErrorRanking[0]?.[1] || 1;

  return (
    <div className="flex flex-col gap-5 pt-2.5">
      {/* Live-Kopfzeile */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex w-[7px] h-[7px]">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75" />
            <span className="relative inline-flex rounded-full w-[7px] h-[7px] bg-ok" />
          </span>
          <span className="text-xs font-bold text-ink-muted uppercase tracking-[0.05em]">Live-Sitzung</span>
        </div>
        <span className="text-xs text-ink-muted">
          Raum-Code: <span className="font-mono font-extrabold text-ink">{roomCode}</span>
        </span>
      </div>

      {/* Stat-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard dotClass="bg-accent" label="Aktiv" value={activeCount} />
        <StatCard dotClass="bg-ok" label="Fertig" value={finishedCount} />
        <StatCard dotClass="bg-ink-faint" label="Gesamtfortschritt" value={`${overall}%`} />
      </div>

      {/* Schüler + Fehler-Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 items-start">
        <div className="bg-surface border border-line rounded-[20px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              {stationMode ? 'Stationen' : 'Schüler'}
            </span>
            <button
              type="button"
              onClick={onExportCSV}
              disabled={exportDisabled}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-ok-soft text-ok text-[11px] font-bold cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3 h-3" />
              <span>Ergebnisse exportieren (CSV)</span>
            </button>
          </div>

          {stationMode ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2 mt-3">
              {stationNums.map((num) => {
                const status = getStationStatus(num);
                const state = stationStates.get(num);
                const progress = state && wordsCount > 0 ? Math.round(((state.currentIndex + 1) / wordsCount) * 100) : 0;
                return (
                  <div
                    key={num}
                    className={`border rounded-[14px] px-2 py-2.5 flex flex-col items-center gap-1 text-center ${
                      status === 'done'
                        ? 'border-ok/40 bg-ok-soft'
                        : status === 'active'
                          ? 'border-accent/40 bg-accent-soft station-pulse'
                          : 'border-line bg-surface'
                    }`}
                  >
                    <div
                      className={`text-xl font-extrabold ${
                        status === 'done' ? 'text-ok' : status === 'active' ? 'text-accent-strong' : 'text-ink-faint'
                      }`}
                    >
                      {num}
                    </div>
                    <span className="text-[9.5px] font-semibold text-ink-muted">
                      {status === 'done' ? 'Fertig' : status === 'active' ? `Wort ${(state?.currentIndex ?? 0) + 1}/${wordsCount}` : 'Inaktiv'}
                    </span>
                    <div className="w-full h-1 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          status === 'done' ? 'bg-ok' : status === 'active' ? 'bg-accent' : 'bg-transparent'
                        }`}
                        style={{ width: status === 'done' ? '100%' : `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : studentsInLobby.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint py-8 text-center">Noch keine Schüler beigetreten…</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 mt-3">
              {studentsInLobby.map((name) => {
                const result = results.find((r) => r.name === name);
                const isFinished = !!result;
                const progress = getStudentProgress(name);
                const wordNo = Math.min((liveProgress[name] ?? 0) + 1, Math.max(wordsCount, 1));
                const stars = isFinished ? computeStars(result.errors ?? 0, result.wordCount ?? wordsCount) : 0;
                return (
                  <div
                    key={name}
                    className="border border-line bg-surface rounded-[14px] px-2 py-2.5 flex flex-col items-center gap-1 text-center"
                    title={
                      isFinished
                        ? `${name}: ${result.errors ?? 0} Fehler · ${result.attempts} Versuche · ${result.peeks} Spicker`
                        : name
                    }
                  >
                    <div className="w-8 h-8 rounded-[9px] bg-surface-2 flex items-center justify-center shrink-0">
                      <AnimalAvatar studentName={name} className="w-[22px] h-[22px]" />
                    </div>
                    <span className="text-[11.5px] font-bold text-ink whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                      {name}
                    </span>
                    {isFinished ? (
                      <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        <span className="text-[9px] font-bold text-ok bg-ok-soft px-2 py-[3px] rounded-full">Fertig</span>
                        {(result.errors ?? 0) > 0 && (
                          <span className="text-[9px] font-bold text-warn bg-warn-soft px-[7px] py-[3px] rounded-full">
                            {result.errors}✕
                          </span>
                        )}
                        {showStars && stars > 0 && (
                          <span className="text-[9px] font-bold text-warn">{'★'.repeat(stars)}</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <span className="text-[9.5px] font-semibold text-ink-muted">
                          {wordsCount > 0 ? `${wordNo}/${wordsCount}` : 'Aktiv'}
                        </span>
                        <div className="w-full h-1 rounded-full bg-surface-2 overflow-hidden">
                          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Häufigste Fehler */}
        <div className="bg-surface border border-line rounded-[20px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Häufigste Fehler</span>
          <div className="flex flex-col gap-3 mt-3.5">
            {stationMode ? (
              <p className="text-[12.5px] text-ink-faint">Im Stations-Modus werden keine Fehler erfasst.</p>
            ) : wordErrorRanking.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">Noch keine Ergebnisse.</p>
            ) : (
              wordErrorRanking.map(([word, count]) => (
                <div key={word} className="flex items-center gap-2.5">
                  <span className="text-[12.5px] font-bold text-ink w-[110px] shrink-0 truncate" title={word}>
                    {word}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-warn"
                      style={{ width: `${Math.max(8, Math.round((count / maxErrorCount) * 100))}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-ink-muted w-4 text-right shrink-0">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
