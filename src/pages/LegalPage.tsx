import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const CONTACT_EMAIL = 'toby.bryson@sksbg.de';

export const LegalPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-brand-bg dark:bg-slate-950 transition-colors duration-300">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors cursor-pointer"
          title="Zurück zur Startseite"
          aria-label="Zurück"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-darkteal-800 dark:text-white">Impressum &amp; Datenschutz</h1>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300 space-y-10">
        {/* Beta-Hinweis */}
        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-4 text-amber-800 dark:text-amber-300">
          <strong className="font-bold">Geschlossene Beta.</strong> Diese Anwendung befindet sich in einer
          geschlossenen Testphase und ist ausschließlich für eingeladene Teilnehmer bestimmt. Keine
          Weitergabe an Dritte. Keine produktive Nutzung.
        </div>

        {/* Impressum */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-darkteal-800 dark:text-white">Impressum</h2>
          <p>Angaben gemäß § 5 DDG / § 18 MStV:</p>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 space-y-1">
            <p><span className="font-semibold">Verantwortlich:</span> Toby Bryson</p>
            <p>
              <span className="font-semibold">Kontakt:</span>{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 dark:text-brand-400 underline underline-offset-2">{CONTACT_EMAIL}</a>
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">
              Nicht-kommerzielles Bildungsprojekt. Eine vollständige Anschrift wird auf Anfrage über die
              oben genannte E-Mail-Adresse mitgeteilt.
            </p>
          </div>
        </section>

        {/* Datenschutz */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-darkteal-800 dark:text-white">Datenschutzerklärung</h2>

          <div className="space-y-1">
            <h3 className="font-bold text-darkteal-800 dark:text-white">1. Verantwortlicher</h3>
            <p>
              Toby Bryson,{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 dark:text-brand-400 underline underline-offset-2">{CONTACT_EMAIL}</a>
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-darkteal-800 dark:text-white">2. Geltungsbereich</h3>
            <p>
              Die Nutzung erfolgt im Rahmen einer geschlossenen Beta, nur für eingeladene Teilnehmer.
              Es werden bewusst so wenige Daten wie möglich verarbeitet.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-darkteal-800 dark:text-white">3. Verarbeitete Daten</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Keine Benutzerkonten, keine Registrierung, keine Klarnamen.</li>
              <li>Als Anzeigename dient ein zufällig erzeugter Tiername (z. B. „Flinker Dackel").</li>
              <li>Raum-Codes zum Verbinden von Lehrer- und Schülergeräten.</li>
              <li>
                Spieleingaben (eingetippte Wörter, Fortschritt) werden ausschließlich in Echtzeit zwischen
                den Geräten übertragen und nicht dauerhaft in einer Datenbank gespeichert.
              </li>
            </ul>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-darkteal-800 dark:text-white">4. Dienste &amp; Hosting</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-semibold">Cloudflare Pages</span> – Auslieferung der Web-App.</li>
              <li><span className="font-semibold">Supabase Realtime</span> – Echtzeit-Übertragung der Raum-Nachrichten (Broadcast).</li>
            </ul>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Beim Aufruf können technisch notwendige Verbindungsdaten (z. B. IP-Adresse) durch diese
              Anbieter verarbeitet werden, um die Anwendung bereitzustellen.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-darkteal-800 dark:text-white">5. Kamera (QR-Scan)</h3>
            <p>
              Der QR-Scanner nutzt die Gerätekamera nur lokal im Browser, um den Raum-Code zu erkennen.
              Es werden keine Bilder gespeichert oder übertragen. Der Zugriff erfolgt erst nach
              ausdrücklicher Erlaubnis.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-darkteal-800 dark:text-white">6. Sprachausgabe</h3>
            <p>Das Vorlesen nutzt die im Browser/Gerät eingebaute Sprachausgabe (Web Speech API) – lokal, ohne Datenübertragung.</p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-darkteal-800 dark:text-white">7. Cookies &amp; Tracking</h3>
            <p>
              Keine Tracking-Cookies und kein Analyse-Tool. Lokal im Browser wird gespeichert, ob die
              Funktionsübersicht bereits gezeigt wurde (bleibt dauerhaft erhalten). Beim Beitritt eines
              Schülers werden Raum-Code und Tiername zusätzlich kurzzeitig im Sitzungsspeicher (sessionStorage)
              abgelegt, um den Beitritt nach einem automatischen App-Update fortzusetzen – das wird spätestens
              beim Schließen des Tabs automatisch gelöscht.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-darkteal-800 dark:text-white">8. Rechte der Betroffenen</h3>
            <p>
              Es bestehen die Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch
              sowie auf Beschwerde bei einer Aufsichtsbehörde. Anfragen bitte an{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 dark:text-brand-400 underline underline-offset-2">{CONTACT_EMAIL}</a>.
            </p>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 pt-2">
            Stand: Beta-Version. Diese Erklärung wird bei Bedarf aktualisiert.
          </p>
        </section>
      </main>
    </div>
  );
};
