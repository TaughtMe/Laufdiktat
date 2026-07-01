import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Dices, Camera, LogIn } from 'lucide-react';
import { AnimalAvatar } from '../components/shared/AnimalAvatar';
import { QrScannerOverlay } from '../components/shared/QrScannerOverlay';
import { useGameStore } from '../store/gameStore';
import { VersionBadge } from '../components/shared/VersionBadge';
import { checkForUpdate, checkForUpdateReady, applyUpdate } from '../pwa';
import { savePendingJoin, readPendingJoin } from '../utils/game/pendingJoin';

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
  const [roomCode, setRoomCode] = useState(() => searchParams.get('room') || '');
  const [studentName, setStudentName] = useState(getRandomName);
  const [scanning, setScanning] = useState(false);
  const [joining, setJoining] = useState(false);
  const resetGameData = useGameStore((s) => s.resetGameData);

  // Sauberer Beitritt: alten Spielzustand verwerfen, dann ins Spiel.
  // Räumt pendingJoin bewusst NICHT auf – das übernimmt erst Game.tsx, sobald
  // die Version passt und die Sitzung wirklich übernommen wurde. Sonst ginge
  // der Raumcode verloren, falls ein Versions-Mismatch noch einen Reload auslöst.
  const enterGame = useCallback((code: string, name: string) => {
    resetGameData();
    navigate('/game', { state: { roomCode: code, studentName: name } });
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

  // Zusätzlich generell auf eine neue Version prüfen (lässt z. B. den
  // VersionBadge-Punkt aufleuchten), auch wenn gerade kein Beitritt läuft.
  useEffect(() => {
    checkForUpdate();
  }, []);

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
      setRoomCode(code);
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

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-brand-bg dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden">
      
      {/* Main Card */}
      <div className="z-10 bg-white dark:bg-slate-900 rounded-[1.8rem] p-8 sm:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.03)] border border-slate-100/50 dark:border-slate-800 flex flex-col items-center text-center space-y-6 w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-500">
        <div className="space-y-1.5">
          <h1 className="text-3.5xl font-black text-slate-900 dark:text-white tracking-tight">
            Laufdiktat
          </h1>
          <p className="text-[0.85rem] text-slate-400 dark:text-slate-500 max-w-[280px] leading-relaxed mx-auto">
            Gib den Raumcode deines Lehrers ein, um zu starten.
          </p>
        </div>
        
        <div className="w-full flex flex-col items-center space-y-4">
          <div className="relative w-full">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="Raum-Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartDictation();
              }}
              className="w-full text-center text-lg font-semibold py-3.5 pl-12 pr-12 rounded-xl border border-slate-100 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-[#0f4a60] dark:text-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none transition-all placeholder:text-[#a0aec0] dark:placeholder:text-slate-700 tracking-wide font-sans"
            />
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-brand-500 hover:bg-brand-500/10 transition-colors cursor-pointer"
              title="QR-Code scannen"
              aria-label="QR-Code scannen"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
          
          {/* Animal Avatar */}
          {studentName && (
            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-300">
              <AnimalAvatar studentName={studentName} className="w-32 h-32 mx-auto" />
            </div>
          )}

          <div className="w-full flex flex-col">
            <input 
              type="text" 
              placeholder="Dein Name"
              value={studentName}
              readOnly
              className="w-full text-center text-lg font-semibold py-3.5 px-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-[#0f4a60] dark:text-white focus:outline-none transition-all"
            />
            <button 
              type="button"
              onClick={generateName}
              className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full"
            >
              <Dices className="w-3.5 h-3.5 text-slate-400" />
              <span>Zufälligen Namen generieren</span>
            </button>
          </div>
          
          <button
            onClick={handleStartDictation}
            disabled={joining}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-base font-bold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer mt-4"
          >
            {joining ? 'Suche nach Update…' : 'Beitreten'}
          </button>
        </div>
      </div>

      {/* Lehrer-Login – direkt unter der Schüler-Karte, gut sichtbar */}
      <Link
        to="/dashboard"
        className="z-10 mt-5 inline-flex items-center gap-2 text-sm font-bold text-darkteal-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 px-6 py-2.5 rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98]"
      >
        <LogIn className="w-4 h-4" />
        Lehrer-Login
      </Link>

      {/* Footer: Impressum/Datenschutz */}
      <div className="z-10 absolute bottom-8 text-sm">
        <Link
          to="/legal"
          className="text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 font-medium transition-colors"
        >
          Impressum &amp; Datenschutz
        </Link>
      </div>

      {scanning && (
        <QrScannerOverlay onResult={handleScanResult} onClose={() => setScanning(false)} />
      )}
      <VersionBadge />
    </div>
  );
};
