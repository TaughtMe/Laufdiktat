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
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
      <div className="text-center mb-6">
        <span className="text-4xl block mb-2">👋</span>
        <h2 className="text-xl font-black text-darkteal-800 dark:text-white">Willkommen im Lehrer-Dashboard</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">In vier Schritten zum Laufdiktat.</p>
      </div>

      <div className="space-y-3">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-2xl shrink-0">{s.icon}</span>
            <div>
              <h3 className="font-bold text-sm text-darkteal-800 dark:text-white">{i + 1}. {s.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full mt-6 py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
      >
        Los geht's
      </button>
    </div>
  </div>
);
