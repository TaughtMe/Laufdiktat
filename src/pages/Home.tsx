import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, CircleAlert, Dices, Camera, LogIn, Moon, Sun } from 'lucide-react';
import { AnimalAvatar } from '../components/shared/AnimalAvatar';
import { QrScannerOverlay } from '../components/shared/QrScannerOverlay';
import { useGameStore } from '../store/gameStore';
import { VersionBadge } from '../components/shared/VersionBadge';
import { clearPendingJoin, savePendingJoin, readPendingJoin, readRoomIdentity } from '../utils/game/pendingJoin';
import { useUpdatePoller } from '../hooks/shared/useUpdatePoller';
import { useTheme } from '../hooks/shared/useTheme';
import { joinRoom } from '../utils/rooms/roomApi';
import { logDevError } from '../utils/shared/logging';

const CODE_LENGTH = 4;
type JoinError = 'missing-code' | 'wrong-code' | 'generic';

const JOIN_ERROR_COPY: Record<JoinError, { title: string; description: string }> = {
  'missing-code': {
    title: 'Raumcode fehlt',
    description: 'Bitte gib den vierstelligen Raumcode deiner Lehrkraft ein.',
  },
  'wrong-code': {
    title: 'Falscher Raumcode',
    description: 'Zu diesem Code wurde kein aktiver Raum gefunden. Prüfe den Code oder frage deine Lehrkraft.',
  },
  generic: {
    title: 'Ups, hier lief wohl etwas falsch',
    description: 'Der Raumbeitritt ist gerade nicht möglich. Prüfe deine Internetverbindung und versuche es erneut.',
  },
};

const toCodeChars = (raw: string): string[] => {
  const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH).split('');
  return Array.from({ length: CODE_LENGTH }, (_, i) => digits[i] ?? '');
};

const ADJECTIVES = ['Schnell', 'Flink', 'Schlau', 'Mutig', 'Wild', 'Kühn', 'Listig', 'Stark', 'Frech'];
const ANIMALS = [
  { name: 'Koala', g: 'm' }, { name: 'Fledermaus', g: 'f' }, { name: 'Kamel', g: 'n' },
  { name: 'Igel', g: 'm' }, { name: 'Capybara', g: 'n' }, { name: 'Eichhörnchen', g: 'n' },
  { name: 'Elefant', g: 'm' }, { name: 'Qualle', g: 'f' }, { name: 'Tiefseefisch', g: 'm' },
  { name: 'Clownfisch', g: 'm' }, { name: 'Schwein', g: 'n' }, { name: 'Ente', g: 'f' },
  { name: 'Phönix', g: 'm' }, { name: 'Kiwi', g: 'm' }, { name: 'Roter Panda', g: 'm' },
  { name: 'Giraffe', g: 'f' }, { name: 'Löwin', g: 'f' }, { name: 'Einhorn', g: 'n' },
  { name: 'Orca', g: 'm' }, { name: 'Schildkröte', g: 'f' }, { name: 'Pfau', g: 'm' },
  { name: 'Hund', g: 'm' }, { name: 'Affe', g: 'm' }, { name: 'Gorilla', g: 'm' },
  { name: 'Fuchs', g: 'm' }, { name: 'Katze', g: 'f' }, { name: 'Sphynx-Katze', g: 'f' },
  { name: 'Lama', g: 'n' }, { name: 'Yak', g: 'n' },
  { name: 'Kobra', g: 'f' }, { name: 'Krokodil', g: 'n' }, { name: 'Zebra', g: 'n' },
  { name: 'Flamingo', g: 'm' }, { name: 'Oktopus', g: 'm' }, { name: 'Chamäleon', g: 'n' },
  { name: 'Hirsch', g: 'm' }, { name: 'Pelikan', g: 'm' }, { name: 'Erdmännchen', g: 'n' },
  { name: 'Käfer', g: 'm' }, { name: 'Heuschrecke', g: 'f' }, { name: 'Schnabeltier', g: 'n' },
  { name: 'Mistkäfer', g: 'm' }, { name: 'Krabbe', g: 'f' }, { name: 'Mammut', g: 'n' },
  { name: 'Kaninchen', g: 'n' }, { name: 'Truthahn', g: 'm' }, { name: 'Gottesanbeterin', g: 'f' },
  { name: 'Esel', g: 'm' }, { name: 'Robbe', g: 'f' }, { name: 'Strauß', g: 'm' },
  { name: 'Taube', g: 'f' }, { name: 'Gepard', g: 'm' }, { name: 'Schmetterling', g: 'm' },
  { name: 'Libelle', g: 'f' }, { name: 'Pudel', g: 'm' }, { name: 'Bobtail', g: 'm' },
  { name: 'Mops', g: 'm' }, { name: 'Schäferhund', g: 'm' }, { name: 'Collie', g: 'm' },
  { name: 'Dackel', g: 'm' }, { name: 'Perserkatze', g: 'f' }
];
const getRandomName = () => {
  const baseAdj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animalObj = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  
  let ending = 'es';
  if (animalObj.g === 'm') {
    ending = 'er';
  } else if (animalObj.g === 'f') {
    ending = 'e';
  }
  return `${baseAdj}${ending} ${animalObj.name}`;
};

export const Home = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [codeChars, setCodeChars] = useState(() => toCodeChars(searchParams.get('room') || ''));
  const roomCode = useMemo(() => codeChars.join(''), [codeChars]);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [studentName, setStudentName] = useState(getRandomName);
  const [scanning, setScanning] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<JoinError | null>(null);
  const resetGameData = useGameStore((s) => s.resetGameData);
  const { dark, toggleTheme } = useTheme();

  // Sauberer Beitritt: alten Spielzustand verwerfen, dann ins Spiel.
  // Räumt pendingJoin bewusst NICHT auf – das übernimmt erst Game.tsx, sobald
  // die Version passt und die Sitzung wirklich übernommen wurde. Sonst ginge
  // der Raumcode verloren, falls ein Versions-Mismatch noch einen Reload auslöst.
  //
  // Der sichere Beitritt registriert das Gerät im Raum und gibt ein zufälliges
  // Teilnehmertoken zurück. Dieses Token ist unsichtbar für den Nutzer und
  // berechtigt ausschließlich zum eigenen Fortschritt in diesem Raum.
  //
  // `auto` unterscheidet den automatisch fortgesetzten Beitritt (Mount-Effekt
  // unten) vom manuell ausgelösten: Ein über Nacht liegen gebliebener Intent
  // trifft auf einen längst beendeten Raum -- dann still aufräumen statt dem
  // Schüler unaufgefordert "Falscher Raum-Code" anzuzeigen.
  const enterGame = useCallback(async (code: string, name: string, existingToken?: string, auto = false) => {
    resetGameData();
    try {
      const room = await joinRoom(code, name, existingToken);
      if (room === null) {
        // Raum existiert nicht (mehr): Identität ist wertlos, alles räumen.
        clearPendingJoin();
        setJoining(false);
        if (!auto) setJoinError('wrong-code');
        return;
      }
      savePendingJoin(code, room.studentName, room.participantToken);
      navigate('/game', {
        state: {
          roomCode: code,
          studentName: room.studentName,
          roomId: room.roomId,
          participantToken: room.participantToken,
        },
      });
    } catch (err) {
      // Transienter Fehler (WLAN-Aussetzer trotz Retry in joinRoom): Intent
      // UND Token bewusst BEHALTEN. Ein clearPendingJoin() hier würde die
      // Geräteidentität genau in dem Moment wegwerfen, für den sie existiert
      // -- der nächste (manuelle) Versuch legte dann einen Doppel-Teilnehmer
      // an, obwohl der Raum das Gerät längst kennt.
      logDevError('[Room] Sicherer Raumbeitritt fehlgeschlagen', err);
      setJoining(false);
      setJoinError('generic');
    }
  }, [navigate, resetGameData]);

  // Beim Öffnen der Startseite prüfen, ob ein Beitritt über einen
  // Update-Reload hinweg fortgesetzt werden muss (siehe joinGame unten).
  useEffect(() => {
    const pending = readPendingJoin();
    if (pending) {
      queueMicrotask(() => {
        void enterGame(pending.code, pending.name, pending.participantToken, true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regelmäßig auf ein neues Update prüfen. Auf der Startseite ist Auto-Apply
  // unbedenklich (kein Spielstand, der verloren gehen könnte) – das fängt den
  // häufigsten Fall ab ("Lehrer frisch deployed, Schülergerät noch veraltet"),
  // ohne dass der Schüler erst einen Raum betreten muss.
  useUpdatePoller({ enabled: true, intervalMs: 3 * 60 * 1000, autoApply: true });

  // Beitritt: sofort in den Warteraum, ohne auf den PWA-Update-Check zu warten
  // (das frühere blockierende `checkForUpdateReady` kostete bis zu 2s bei JEDEM
  // Beitritt, auch wenn das Gerät längst aktuell war). Die neue Version wird
  // bereits beim Öffnen der Startseite im Hintergrund eingespielt
  // (useUpdatePoller mit autoApply prüft sofort beim Mount und dann alle 3 Min);
  // ein echter Versionsunterschied zum Lehrer wird beim Rundenstart endgültig
  // abgefangen (session-start-Vergleich + VersionMismatchOverlay in Game.tsx).
  // Der Beitrittswunsch bleibt in sessionStorage gemerkt und wird nach einem
  // eventuellen Update-Reload oben automatisch fortgesetzt.
  const joinGame = useCallback((code: string, name: string) => {
    // Identität statt Intent lesen: Auch wenn die Auto-Join-Absicht längst
    // geräumt wurde (Runde fertig, bewusst verlassen), verwendet ein erneuter
    // manueller Beitritt zum selben Raum das gemerkte Token wieder -- der
    // Server erkennt das Gerät und gibt DIESELBE Identität zurück, statt
    // einen Doppel-Teilnehmer anzulegen.
    const existingToken = readRoomIdentity(code)?.participantToken;
    savePendingJoin(code, name, existingToken);

    setJoining(true);
    void enterGame(code, name, existingToken);
  }, [enterGame]);

  // QR-Code-Ergebnis: Raum-Code aus der URL (?room=) extrahieren, sonst
  // Zahlenfolge. Anschließend automatisch beitreten (Warte-auf-Lehrer-Screen).
  const handleScanResult = useCallback((text: string) => {
    let code = '';
    try {
      code = new URL(text).searchParams.get('room') || '';
    } catch {
      // kein gültiger URL-String – ignorieren
    }
    if (!code) {
      const match = text.match(/\d{3,}/);
      code = match ? match[0] : text.trim();
    }
    setScanning(false);
    if (code) {
      setCodeChars(toCodeChars(code));
      joinGame(code, studentName);
    }
  }, [joinGame, studentName]);

  const generateName = () => {
    setStudentName(getRandomName());
  };

  const handleStartDictation = () => {
    if (roomCode.length === CODE_LENGTH && studentName.trim().length > 0) {
      setJoinError(null);
      joinGame(roomCode, studentName);
    } else {
      setJoinError('missing-code');
    }
  };

  const returnToCodeEntry = () => {
    if (joinError !== 'generic') setCodeChars(toCodeChars(''));
    setJoinError(null);
    setJoining(false);
    requestAnimationFrame(() => digitRefs.current[0]?.focus());
  };

  // Raum-Code als vier Einzelfelder: Eingabe eines Ziffer springt automatisch
  // ins nächste Feld, Backspace in einem leeren Feld springt zurück und löscht
  // die vorherige Ziffer (klassisches PIN-Eingabe-Verhalten).
  const handleDigitChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    setCodeChars((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleStartDictation();
    } else if (e.key === 'Backspace' && !codeChars[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
      setCodeChars((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  // Ganzen Code auf einmal einfügen (z. B. aus der Zwischenablage) – verteilt
  // die Ziffern statt nur die erste ins angeklickte Feld zu schreiben.
  const handleDigitPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted.length <= 1) return;
    e.preventDefault();
    setCodeChars(toCodeChars(pasted));
    digitRefs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center [@media(max-width:639px)_and_(orientation:portrait)]:justify-center px-4 py-6 sm:py-8 [@media(max-height:700px)]:py-3 bg-page transition-colors duration-300 relative overflow-x-hidden">
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-20 w-10 h-10 rounded-full bg-surface-2 text-ink-muted flex items-center justify-center cursor-pointer hover:text-ink transition-colors shadow-sm"
        title={dark ? 'Helles Design' : 'Dunkles Design'}
        aria-label={dark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
      >
        {dark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
      </button>

      {/* Main Card */}
      {joinError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="z-10 bg-surface rounded-[28px] p-7 sm:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.03)] flex flex-col items-center text-center w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-300"
        >
          <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center mb-6 ${joinError === 'generic' ? 'bg-danger/10 text-danger' : 'bg-accent-soft'}`}>
            {joinError === 'generic' ? (
              <CircleAlert className="w-14 h-14" strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <img
                src="/face-expectation.svg"
                alt=""
                className="h-[78%] w-auto"
                aria-hidden="true"
              />
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight">
            {JOIN_ERROR_COPY[joinError].title}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-ink-muted leading-relaxed max-w-[310px]">
            {JOIN_ERROR_COPY[joinError].description}
          </p>

          <button
            type="button"
            onClick={returnToCodeEntry}
            className="mt-7 w-full bg-accent hover:opacity-90 text-white text-base font-extrabold py-3.5 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            Zur Code-Eingabe
          </button>
        </div>
      ) : (
      <div className="z-10 bg-surface rounded-[28px] p-5 sm:p-8 md:p-10 [@media(max-height:700px)]:p-4 shadow-[0_10px_35px_rgba(0,0,0,0.03)] flex flex-col items-center text-center space-y-4 sm:space-y-6 [@media(max-height:700px)]:space-y-2 w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-500">
        <div className="space-y-1 sm:space-y-1.5">
          <h1 className="text-2.5xl sm:text-3.5xl font-black text-ink tracking-tight">
            Laufdiktat
          </h1>
          <p className="text-[0.8rem] sm:text-[0.85rem] text-ink-muted max-w-[280px] leading-relaxed mx-auto">
            Gib den Raumcode deines Lehrers ein, um zu starten.
          </p>
        </div>

        <div className="w-full flex flex-col items-center space-y-3 sm:space-y-4">
          {/* Raum-Code: vier Einzelfelder + Kamera-Button, Cursor wandert
              beim Tippen automatisch ins nächste Feld. */}
          <div className="w-full grid grid-cols-5 gap-2 sm:gap-2.5">
            {codeChars.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { digitRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                onPaste={handleDigitPaste}
                aria-label={`Raum-Code Ziffer ${i + 1}`}
                className="aspect-square w-full text-center text-xl sm:text-2xl font-extrabold rounded-2xl bg-surface-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              />
            ))}
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="aspect-square w-full rounded-2xl bg-accent-soft text-accent-strong hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center"
              title="QR-Code scannen"
              aria-label="QR-Code scannen"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          {/* Animal Avatar */}
          {studentName && (
            <div className="w-24 h-24 sm:w-32 sm:h-32 [@media(max-height:700px)]:w-16 [@media(max-height:700px)]:h-16 rounded-full bg-surface-2 flex items-center justify-center animate-in fade-in zoom-in-95 duration-300">
              <AnimalAvatar studentName={studentName} className="w-[70%] h-[70%]" />
            </div>
          )}

          <div className="w-full flex flex-col">
            <div className="w-full text-center text-lg font-bold py-3 sm:py-3.5 px-4 rounded-2xl bg-surface-2 text-ink">
              {studentName}
            </div>
            <button
              type="button"
              onClick={generateName}
              className="mt-2.5 sm:mt-3 text-xs font-semibold text-ink-faint hover:text-ink-muted flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Zufälligen Namen generieren</span>
            </button>
          </div>

          <button
            onClick={handleStartDictation}
            disabled={joining}
            className="w-full bg-accent hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-base font-extrabold py-3 sm:py-3.5 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer mt-3 sm:mt-4"
          >
            {joining ? 'Trete bei…' : 'Beitreten'}
          </button>
        </div>
      </div>
      )}

      {/* Lehrer-Login + Impressum – bewusst im normalen Fluss (nicht absolut
          positioniert), damit auf kleinen Höhen nichts überlappt, sondern die
          Seite notfalls scrollt. */}
      <div className="z-10 w-full flex flex-col items-center gap-3 mt-4 sm:mt-5 [@media(max-height:700px)]:mt-2 pb-6 [@media(max-height:700px)]:pb-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-bold text-ink bg-surface border border-line hover:bg-surface-2 px-6 py-2.5 rounded-full shadow-sm hover:shadow transition-all active:scale-[0.98]"
        >
          <LogIn className="w-4 h-4" />
          Lehrer-Login
        </Link>

        <Link
          to="/legal"
          className="text-sm text-ink-faint hover:text-ink-muted font-medium transition-colors"
        >
          Impressum &amp; Datenschutz
        </Link>

        <VersionBadge fixed={false} />
      </div>

      {scanning && (
        <QrScannerOverlay onResult={handleScanResult} onClose={() => setScanning(false)} />
      )}
    </div>
  );
};
