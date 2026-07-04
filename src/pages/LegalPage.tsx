import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/shared/useTheme';

const CONTACT_EMAIL = 'toby.bryson@sksbg.de';

export const LegalPage: React.FC = () => {
  const navigate = useNavigate();
  const { dark, toggleTheme } = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-[100dvh] bg-page">
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm border-b border-line px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-full hover:bg-surface-2 text-ink-faint hover:text-ink-muted transition-colors cursor-pointer"
            title="Zurück zur Startseite"
            aria-label="Zurück"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold text-ink">Impressum &amp; Datenschutz</h1>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full bg-surface-2 text-ink-muted flex items-center justify-center cursor-pointer hover:text-ink transition-colors shrink-0"
          title={dark ? 'Helles Design' : 'Dunkles Design'}
          aria-label={dark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
        >
          {dark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 text-sm leading-relaxed text-ink-muted space-y-10">
        {/* Beta-Hinweis */}
        <div className="rounded-[18px] border border-warn/30 bg-warn-soft p-4 text-warn">
          <strong className="font-extrabold">Geschlossene Beta.</strong> Diese Anwendung befindet sich in einer
          geschlossenen Testphase und ist ausschließlich für eingeladene Teilnehmer bestimmt. Keine
          Weitergabe an Dritte. Keine produktive Nutzung.
        </div>

        {/* Impressum */}
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold text-ink">Impressum</h2>
          <p>Angaben gemäß § 5 DDG / § 18 MStV:</p>
          <div className="rounded-[16px] bg-surface border border-line p-4 space-y-1">
            <p><span className="font-bold text-ink">Verantwortlich:</span> Toby Bryson</p>
            <p>
              <span className="font-bold text-ink">Kontakt:</span>{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent-strong underline underline-offset-2 hover:opacity-80">{CONTACT_EMAIL}</a>
            </p>
            <p className="text-xs text-ink-faint pt-1">
              Nicht-kommerzielles Bildungsprojekt. Eine vollständige Anschrift wird auf Anfrage über die
              oben genannte E-Mail-Adresse mitgeteilt.
            </p>
          </div>
        </section>

        {/* Urheberrecht */}
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold text-ink">Urheberrecht &amp; Quellenangaben</h2>

          <div className="space-y-1">
            <h3 className="font-bold text-ink">1. Eigene Inhalte</h3>
            <p>
              © {currentYear} Toby Bryson. Konzept, Quellcode und eigens erstellte Inhalte dieser Anwendung sind
              urheberrechtlich geschützt. Vervielfältigung, Bearbeitung, Verbreitung oder jede Art der
              Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der vorherigen schriftlichen
              Zustimmung.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-ink">2. Eingesetzte Inhalte Dritter</h3>
            <p>Diese Anwendung nutzt folgende fremde Inhalte im Rahmen der jeweiligen Lizenzbedingungen:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-bold text-ink">Schriftart „Plus Jakarta Sans"</span> – lizenziert unter der
                SIL Open Font License 1.1.
              </li>
              <li>
                <span className="font-bold text-ink">Tier-Illustrationen</span> – von{' '}
                <span className="font-semibold">CocoMaterial</span>, lizenziert unter CC0 1.0 (gemeinfrei,
                Namensnennung nicht erforderlich).
              </li>
              <li>
                <span className="font-bold text-ink">Symbol-Icons</span> – von{' '}
                <span className="font-semibold">Lucide</span> (ISC-Lizenz); einzelne Icons stammen ursprünglich
                aus dem Feather-Projekt (MIT-Lizenz, © Cole Bemis).
              </li>
              <li>
                Weitere eingesetzte Open-Source-Software (u.&nbsp;a. React, Supabase-Client) unterliegt jeweils
                eigenen, überwiegend permissiven Lizenzen (MIT/ISC/Apache-2.0). Eine vollständige Liste aller
                verwendeten Bibliotheken samt Lizenzen wird auf Anfrage zur Verfügung gestellt.
              </li>
            </ul>
          </div>
        </section>

        {/* Datenschutz */}
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold text-ink">Datenschutzerklärung</h2>

          <div className="space-y-1">
            <h3 className="font-bold text-ink">1. Verantwortlicher</h3>
            <p>
              Toby Bryson,{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent-strong underline underline-offset-2 hover:opacity-80">{CONTACT_EMAIL}</a>
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-ink">2. Geltungsbereich</h3>
            <p>
              Die Nutzung erfolgt im Rahmen einer geschlossenen Beta, nur für eingeladene Teilnehmer.
              Es werden bewusst so wenige Daten wie möglich verarbeitet.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-ink">3. Verarbeitete Daten</h3>
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
            <h3 className="font-bold text-ink">4. Dienste &amp; Hosting</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-bold text-ink">Cloudflare Pages</span> – Auslieferung der Web-App.</li>
              <li><span className="font-bold text-ink">Supabase Realtime</span> – Echtzeit-Übertragung der Raum-Nachrichten (Broadcast).</li>
            </ul>
            <p className="text-xs text-ink-faint">
              Beim Aufruf können technisch notwendige Verbindungsdaten (z. B. IP-Adresse) durch diese
              Anbieter verarbeitet werden, um die Anwendung bereitzustellen.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-ink">5. Kamera (QR-Scan)</h3>
            <p>
              Der QR-Scanner nutzt die Gerätekamera nur lokal im Browser, um den Raum-Code zu erkennen.
              Es werden keine Bilder gespeichert oder übertragen. Der Zugriff erfolgt erst nach
              ausdrücklicher Erlaubnis.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-ink">6. Sprachausgabe</h3>
            <p>Das Vorlesen nutzt die im Browser/Gerät eingebaute Sprachausgabe (Web Speech API) – lokal, ohne Datenübertragung.</p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-ink">7. Cookies &amp; Tracking</h3>
            <p>
              Keine Tracking-Cookies und kein Analyse-Tool. Lokal im Browser wird gespeichert, ob die
              Funktionsübersicht bereits gezeigt wurde und ob helles oder dunkles Design gewählt wurde
              (bleibt jeweils dauerhaft erhalten). Beim Beitritt eines Schülers werden Raum-Code und
              Tiername zusätzlich kurzzeitig im Sitzungsspeicher (sessionStorage) abgelegt, um den Beitritt
              nach einem automatischen App-Update fortzusetzen – das wird spätestens beim Schließen des
              Tabs automatisch gelöscht.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-ink">8. Rechte der Betroffenen</h3>
            <p>
              Es bestehen die Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch
              sowie auf Beschwerde bei einer Aufsichtsbehörde. Anfragen bitte an{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent-strong underline underline-offset-2 hover:opacity-80">{CONTACT_EMAIL}</a>.
            </p>
          </div>

          <p className="text-xs text-ink-faint pt-2">
            Stand: Beta-Version. Diese Erklärung wird bei Bedarf aktualisiert.
          </p>
        </section>
      </main>
    </div>
  );
};
