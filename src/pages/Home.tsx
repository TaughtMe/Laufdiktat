import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Dices } from 'lucide-react';
import { AnimalAvatar } from '../components/AnimalAvatar';

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
  { name: 'Spielzeugkatze', g: 'f' }, { name: 'Lama', g: 'n' }, { name: 'Yak', g: 'n' },
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
  { name: 'Dackel', g: 'm' }, { name: 'Perserkatze', g: 'f' }, { name: 'Europäisch Kurzhaar', g: 'f' }
];

export const Home = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');

  const generateName = () => {
    const baseAdj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animalObj = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    
    let ending = 'es';
    if (animalObj.g === 'm') {
      ending = 'er';
    } else if (animalObj.g === 'f') {
      ending = 'e';
    }
    
    setStudentName(`${baseAdj}${ending} ${animalObj.name}`);
  };

  useEffect(() => {
    generateName();
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setRoomCode(roomParam);
    }
  }, [searchParams]);

  const handleStartDictation = () => {
    if (roomCode.trim().length > 0 && studentName.trim().length > 0) {
      navigate('/game', { state: { roomCode, studentName } });
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
          <input 
            type="number" 
            placeholder="Raum-Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStartDictation();
            }}
            className="w-full text-center text-lg font-semibold py-3.5 px-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-[#0f4a60] dark:text-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none transition-all placeholder:text-[#a0aec0] dark:placeholder:text-slate-700 tracking-wide font-sans"
          />
          
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
            className="w-full bg-brand-500 hover:bg-brand-600 text-white text-base font-bold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer mt-4"
          >
            Beitreten
          </button>
        </div>
      </div>

      {/* Footer Link */}
      <div className="z-10 absolute bottom-8 text-sm">
        <Link 
          to="/dashboard" 
          className="text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 font-medium transition-colors"
        >
          Login
        </Link>
      </div>
    </div>
  );
};
