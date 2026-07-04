import { VersionBadge } from '../shared/VersionBadge';

/**
 * Einmalige Funktionsübersicht beim ersten Öffnen des Lehrer-Dashboards.
 * Der „gesehen"-Status wird in localStorage gemerkt.
 */
export const ONBOARDING_KEY = 'laufdiktat_dashboard_onboarded';

const STEPS = [
  { icon: '📝', title: 'Wortliste einfügen', text: 'Text einfügen und automatisch nach Sätzen oder Zeilen aufteilen – oder einzelne Chunks manuell markieren.' },
  { icon: '⚙️', title: 'Modus & Optionen', text: 'Laufdiktat, Freie Übung, Battle oder Stationen. Optionen wie Ton, Versuche oder Störangriffe je nach Modus.' },
  { icon: '📲', title: 'Lobby öffnen', text: 'Schüler treten per QR-Code oder Raum-Code bei – ein Gerät genügt zum Start.' },
  { icon: '📊', title: 'Live verfolgen', text: 'Im Live-Tab zeigt sich, wer wie weit ist. Ergebnisse lassen sich als CSV exportieren.' },
];

export const DashboardOnboarding = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-surface border border-line rounded-[22px] p-6 sm:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
      <div className="text-center mb-6">
        <span className="text-4xl block mb-2">👋</span>
        <h2 className="text-xl font-black text-ink">Willkommen im Lehrer-Dashboard</h2>
        <p className="text-sm text-ink-muted mt-1">In vier Schritten zum Laufdiktat.</p>
        <div className="mt-3 flex justify-center">
          <VersionBadge fixed={false} />
        </div>
      </div>

      <div className="space-y-3">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 border border-line">
            <span className="text-2xl shrink-0">{s.icon}</span>
            <div>
              <h3 className="font-bold text-sm text-ink">{i + 1}. {s.title}</h3>
              <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full mt-6 py-3.5 bg-accent hover:opacity-90 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
      >
        Los geht's
      </button>
    </div>
  </div>
);
