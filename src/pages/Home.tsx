import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Dices, Camera, LogIn, Moon, Sun } from 'lucide-react';
import { AnimalAvatar } from '../components/shared/AnimalAvatar';
import { QrScannerOverlay } from '../components/shared/QrScannerOverlay';
import { useGameStore } from '../store/gameStore';
import { VersionBadge } from '../components/shared/VersionBadge';
import { checkForUpdateReady, applyUpdate } from '../pwa';
import { savePendingJoin, readPendingJoin } from '../utils/game/pendingJoin';
import { useUpdatePoller } from '../hooks/shared/useUpdatePoller';
import { useTheme } from '../hooks/shared/useTheme';
import { findActiveRoom } from '../utils/rooms/roomApi';

const CODE_LENGTH = 4;
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
  { name: 'Mops', g: 'm' }, { name: 'Deutscher Schäferhund', g: 'm' }, { name: 'Collie', g: 'm' },
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
  const resetGameData = useGameStore((s) => s.resetGameData);
  const { dark, toggleTheme } = useTheme();

  // Sauberer Beitritt: alten Spielzustand verwerfen, dann ins Spiel.
  // Räumt pendingJoin bewusst NICHT auf – das übernimmt erst Game.tsx, sobald
  // die Version passt und die Sitzung wirklich übernommen wurde. Sonst ginge
  // der Raumcode verloren, falls ein Versions-Mismatch noch einen Reload auslöst.
  //
  // Prüft vorab per findActiveRoom(), ob der Code überhaupt zu einem
  // beitrittsfähigen Raum gehört -- vorher landete ein falscher/veralteter
  // Code kommentarlos auf dem endlosen "Warte auf Lehrer..."-Screen. Ein
  // eindeutiges "kein Raum gefunden" bricht sofort ab; ein Fehler bei der
  // Anfrage selbst (Netzwerk, Migration noch nicht angewendet) blockiert
  // NICHT -- dann greift wie bisher der reine Broadcast-Pfad als Fallback.
  // roomId (nie das schreibfähige access_token, siehe roomApi.ts) wandert
  // mit in den Navigations-State, damit Game.tsx/useGameRoom.ts bei Bedarf
  // selbst den aktuellen Raum-Zustand nachlesen können.
  const enterGame = useCallback(async (code: string, name: string) => {
    resetGameData();
    let roomId: string | undefined;
    try {
      const room = await findActiveRoom(code);
      if (room === null) {
        alert('Kein Raum mit diesem Code gefunden. Bitte Code prüfen oder bei der Lehrkraft nachfragen.');
        return;
      }
      roomId = room.roomId;
    } catch (err) {
      console.error('[Room] find_active_room() fehlgeschlagen, fahre ohne Vorab-Prüfung fort', err);
    }
    navigate('/game', { state: { roomCode: code, studentName: name, roomId } });
  }, [navigate, resetGameData]);

  // Beim Öffnen der Startseite prüfen, ob ein Beitritt über einen
  // Update-Reload hinweg fortgesetzt werden muss (siehe joinGame unten).
  useEffect(() => {
    const pending = readPendingJoin();
    if (pending) {
      enterGame(pending.code, pending.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regelmäßig auf ein neues Update prüfen. Auf der Startseite ist Auto-Apply
  // unbedenklich (kein Spielstand, der verloren gehen könnte) – das fängt den
  // häufigsten Fall ab ("Lehrer frisch deployed, Schülergerät noch veraltet"),
  // ohne dass der Schüler erst einen Raum betreten muss.
  useUpdatePoller({ enabled: true, intervalMs: 3 * 60 * 1000, autoApply: true });

  // Beitritt: zuerst zuverlässig auf ein fertig installiertes Update warten
  // (checkForUpdateReady wartet – anders als ein reines reg.update() – auch
  // auf das asynchrone "needRefresh") und es ggf. anwenden, damit Schülergeräte
  // nicht mit einer veralteten PWA-Version ins Spiel starten. Der
  // Beitrittswunsch wird dafür in sessionStorage gemerkt und nach einem
  // Update-Reload oben automatisch fortgesetzt.
  const joinGame = useCallback(async (code: string, name: string) => {
    savePendingJoin(code, name);

    setJoining(true);
    const updateReady = await checkForUpdateReady();
    if (updateReady) {
      applyUpdate(); // lädt neu; der Beitritt wird oben automatisch fortgesetzt
      return;
    }
    setJoining(false);
    enterGame(code, name);
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
    if (roomCode.trim().length > 0 && studentName.trim().length > 0) {
      joinGame(roomCode, studentName);
    } else {
      alert("Bitte gib einen Raum-Code ein und wähle einen Namen");
    }
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
    <div className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:py-8 [@media(max-height:700px)]:py-3 bg-page transition-colors duration-300 relative overflow-x-hidden">
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
            {joining ? 'Suche nach Update…' : 'Beitreten'}
          </button>
        </div>
      </div>

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
