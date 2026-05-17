import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

export const Home = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setRoomCode(roomParam);
      setTimeout(() => {
        navigate('/game', { state: { roomCode: roomParam } });
      }, 500);
    }
  }, [searchParams, navigate]);

  const handleStartDictation = () => {
    if (roomCode.trim().length > 0) {
      navigate('/game', { state: { roomCode } });
    } else {
      alert("Bitte gib einen Raum-Code ein");
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden">
      
      {/* Background Animation */}
      <div className="bg-anim-container text-slate-800 dark:text-slate-200">
        <div className="bg-anim-phone">
          <div className="bg-anim-touchpoint tl"></div>
          <div className="bg-anim-touchpoint tr"></div>
          <div className="bg-anim-touchpoint bl"></div>
          <div className="bg-anim-touchpoint br"></div>
          
          <div className="bg-anim-text"></div>
          
          <div className="bg-anim-input-container">
            <div className="bg-anim-input-text"></div>
            <div className="bg-anim-confetti"></div>
            <div className="bg-anim-confetti"></div>
            <div className="bg-anim-confetti"></div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="z-10 bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-8 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Laufdiktat
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Gib den Raumcode deines Lehrers ein, um zu starten.
          </p>
        </div>
        
        <div className="w-full flex flex-col items-center space-y-6">
          <input 
            type="number" 
            placeholder="Raum-Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStartDictation();
            }}
            className="w-full text-center text-3xl font-bold tracking-widest p-4 rounded-2xl outline-none border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-slate-700"
          />
          
          <button 
            onClick={handleStartDictation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all active:scale-[0.98]"
          >
            Start
          </button>
        </div>
      </div>

      {/* Footer Link */}
      <div className="z-10 absolute bottom-8 text-sm">
        <Link 
          to="/dashboard" 
          className="text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 font-medium transition-colors"
        >
          Lehrer-Dashboard
        </Link>
      </div>
    </div>
  );
};
