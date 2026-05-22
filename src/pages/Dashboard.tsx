import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  FileText, 
  Type, 
  Highlighter, 
  HelpCircle,
  Sparkles,
  ArrowRight,
  ListRestart,
  User,
  Trash2,
  Check,
  Info,
  X,
  ChevronLeft,
  Activity,
  XCircle
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useGameStore } from '../store/gameStore';
import { parseCSV } from '../utils/csvParser';
import { AnimalAvatar } from '../components/AnimalAvatar';
import type { GameMode, StationStudentState } from '../types/game';

type DashboardStep = 'IMPORT' | 'SETTINGS' | 'LOBBY' | 'LIVE';

interface StudentResult {
  name?: string;
  score: number;
  peeks: number;
  attempts: number;
}



export const Dashboard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<DashboardStep>('IMPORT');
  const stepRef = useRef<DashboardStep>('IMPORT');

  useEffect(() => {
    stepRef.current = currentStep;
  }, [currentStep]);

  const [manualInput, setManualInput] = useState('');
  const [importMode, setImportMode] = useState<'lines' | 'sentences' | 'manual'>('lines');
  const [manualChunks, setManualChunks] = useState<Array<{ id: string; start: number; end: number; text: string }>>([]);
  const highlightContainerRef = useRef<HTMLDivElement>(null);

  const [roomCode, setRoomCode] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [studentsInLobby, setStudentsInLobby] = useState<string[]>([]);
  const [connectionWarning, setConnectionWarning] = useState(false);

  // Station mode RAM state
  const [stationStates, setStationStates] = useState<Map<number, StationStudentState>>(new Map());
  const stationStatesRef = useRef<Map<number, StationStudentState>>(new Map());

  useEffect(() => {
    stationStatesRef.current = stationStates;
  }, [stationStates]);
  
  const words = useGameStore((state) => state.words);
  const setWords = useGameStore((state) => state.setWords);
  const gameMode = useGameStore((state) => state.gameMode);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const battleOptions = useGameStore((state) => state.battleOptions);
  const setBattleOptions = useGameStore((state) => state.setBattleOptions);
  const stationMode = useGameStore((state) => state.stationMode);
  const setStationMode = useGameStore((state) => state.setStationMode);
  const stationCount = useGameStore((state) => state.stationCount);
  const setStationCount = useGameStore((state) => state.setStationCount);

  useEffect(() => {
    setRoomCode(Math.floor(1000 + Math.random() * 9000).toString());
  }, []);

  const handleOpenLobby = async () => {
    if (words.length === 0) {
      alert("Bitte füge zuerst Wörter hinzu!");
      return;
    }
    const channel = supabase.channel(`room-${roomCode}`);
    
    channel.on(
      'broadcast',
      { event: 'student-joined' },
      (payload) => {
        if (payload.payload?.name) {
          setStudentsInLobby((prev) => {
            if (!prev.includes(payload.payload.name)) {
              return [...prev, payload.payload.name];
            }
            return prev;
          });
          
          if (stepRef.current === 'LIVE') {
            channel.send({
              type: 'broadcast',
              event: 'session-start',
              payload: {
                words,
                gameMode,
                battleOptions,
                stationMode,
                stationCount
              }
            });
          }
        }
      }
    );

    channel.on(
      'broadcast',
      { event: 'student-finished' },
      (payload) => {
        setResults((prev) => [...prev, payload.payload as StudentResult]);
      }
    );

    // Station mode listeners
    channel.on(
      'broadcast',
      { event: 'request-station-state' },
      (payload) => {
        const { studentNumber } = payload.payload;
        const current = stationStatesRef.current.get(studentNumber) || { currentIndex: 0, peeks: 0 };
        channel.send({
          type: 'broadcast',
          event: 'sync-station-state',
          payload: { studentNumber, ...current }
        });
      }
    );

    channel.on(
      'broadcast',
      { event: 'update-station-state' },
      (payload) => {
        const { studentNumber, currentIndex, peeks } = payload.payload;
        setStationStates((prev) => {
          const next = new Map(prev);
          next.set(studentNumber, { currentIndex, peeks });
          return next;
        });
      }
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionWarning(false);
        setCurrentStep('LOBBY');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnectionWarning(true);
      }
    });
  };

  const handleStartSession = () => {
    const channel = supabase.channel(`room-${roomCode}`);
    channel.send({
      type: 'broadcast',
      event: 'session-start',
      payload: {
        words,
        gameMode,
        battleOptions,
        stationMode,
        stationCount
      }
    });
    setCurrentStep('LIVE');
  };

  const handleEndSession = async () => {
    const channel = supabase.channel(`room-${roomCode}`);
    await channel.send({ type: 'broadcast', event: 'session-ended' });
    await supabase.removeChannel(channel);
    setCurrentStep('IMPORT');
    setWords([]);
    setResults([]);
    setStudentsInLobby([]);
    setStationStates(new Map());
    setRoomCode(Math.floor(1000 + Math.random() * 9000).toString());
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setManualInput(value);
    setManualChunks([]); // Reset manual highlighting when raw text changes
    const parsed = parseCSV(value, importMode === 'manual' ? 'lines' : importMode);
    setWords(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setManualInput(text);
      setManualChunks([]); // Reset manual highlighting when raw text changes
      const parsed = parseCSV(text, importMode === 'manual' ? 'lines' : importMode);
      setWords(parsed);
    };
    reader.readAsText(file);
  };

  const handleImportModeChange = (mode: 'lines' | 'sentences' | 'manual') => {
    setImportMode(mode);
    if (mode === 'manual') {
      const newWords = [...manualChunks]
        .sort((a, b) => a.start - b.start)
        .map(chunk => ({
          id: chunk.id,
          targetWord: chunk.text.trim(),
          isCompleted: false
        }));
      setWords(newWords);
    } else {
      const parsed = parseCSV(manualInput, mode);
      setWords(parsed);
    }
  };

  const getSegments = () => {
    const segments: Array<{ start: number; end: number; text: string; isHighlighted: boolean; chunkId?: string }> = [];
    const sortedChunks = [...manualChunks].sort((a, b) => a.start - b.start);
    let lastIndex = 0;

    for (const chunk of sortedChunks) {
      if (chunk.start > lastIndex) {
        segments.push({
          start: lastIndex,
          end: chunk.start,
          text: manualInput.substring(lastIndex, chunk.start),
          isHighlighted: false
        });
      }
      segments.push({
        start: chunk.start,
        end: chunk.end,
        text: chunk.text,
        isHighlighted: true,
        chunkId: chunk.id
      });
      lastIndex = chunk.end;
    }

    if (lastIndex < manualInput.length) {
      segments.push({
        start: lastIndex,
        end: manualInput.length,
        text: manualInput.substring(lastIndex),
        isHighlighted: false
      });
    }

    return segments;
  };

  const tokenizeText = (text: string, segmentStart: number) => {
    const tokens: Array<{ text: string; start: number; end: number; isWord: boolean }> = [];
    const regex = /(\p{L}+|\p{N}+)/gu;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const wordText = match[0];
      const end = regex.lastIndex;
      
      if (start > lastIndex) {
        tokens.push({
          text: text.substring(lastIndex, start),
          start: segmentStart + lastIndex,
          end: segmentStart + start,
          isWord: false
        });
      }
      
      tokens.push({
        text: wordText,
        start: segmentStart + start,
        end: segmentStart + end,
        isWord: true
      });
      
      lastIndex = end;
    }
    
    if (lastIndex < text.length) {
      tokens.push({
        text: text.substring(lastIndex),
        start: segmentStart + lastIndex,
        end: segmentStart + text.length,
        isWord: false
      });
    }
    
    return tokens;
  };

  const getTokens = () => {
    return tokenizeText(manualInput, 0);
  };

  const handleWordClick = (start: number, end: number, wordText: string) => {
    if (importMode !== 'manual') return;

    // Check if this word is already in an existing chunk
    const existingChunkIndex = manualChunks.findIndex(
      (c) => start >= c.start && end <= c.end
    );

    if (existingChunkIndex !== -1) {
      // Remove this chunk
      handleDeleteChunk(manualChunks[existingChunkIndex].id);
      return;
    }

    // Check if we can merge with adjacent highlighted chunks
    const tokens = getTokens();
    const clickedTokenIdx = tokens.findIndex((t) => t.start === start && t.end === end);
    if (clickedTokenIdx === -1) return;

    // Find nearest highlighted chunk to the left (no other words in between)
    let leftChunkIdx = -1;
    let canMergeLeft = false;
    let searchIdx = clickedTokenIdx - 1;
    let hasWordBetweenLeft = false;
    while (searchIdx >= 0) {
      const t = tokens[searchIdx];
      if (t.isWord) {
        const chunk = manualChunks.find((c) => t.start >= c.start && t.end <= c.end);
        if (chunk) {
          leftChunkIdx = manualChunks.indexOf(chunk);
          canMergeLeft = !hasWordBetweenLeft;
        } else {
          hasWordBetweenLeft = true;
        }
        break;
      }
      searchIdx--;
    }

    // Find nearest highlighted chunk to the right (no other words in between)
    let rightChunkIdx = -1;
    let canMergeRight = false;
    searchIdx = clickedTokenIdx + 1;
    let hasWordBetweenRight = false;
    while (searchIdx < tokens.length) {
      const t = tokens[searchIdx];
      if (t.isWord) {
        const chunk = manualChunks.find((c) => t.start >= c.start && t.end <= c.end);
        if (chunk) {
          rightChunkIdx = manualChunks.indexOf(chunk);
          canMergeRight = !hasWordBetweenRight;
        } else {
          hasWordBetweenRight = true;
        }
        break;
      }
      searchIdx++;
    }

    let newChunks = [...manualChunks];

    if (canMergeLeft && canMergeRight && leftChunkIdx !== -1 && rightChunkIdx !== -1 && leftChunkIdx !== rightChunkIdx) {
      // Merge left and right chunks with clicked word!
      const leftChunk = manualChunks[leftChunkIdx];
      const rightChunk = manualChunks[rightChunkIdx];
      const mergedStart = leftChunk.start;
      const mergedEnd = rightChunk.end;
      const mergedText = manualInput.substring(mergedStart, mergedEnd);

      newChunks = newChunks.filter((_, i) => i !== leftChunkIdx && i !== rightChunkIdx);
      newChunks.push({
        id: crypto.randomUUID(),
        start: mergedStart,
        end: mergedEnd,
        text: mergedText,
      });
    } else if (canMergeLeft && leftChunkIdx !== -1) {
      // Merge left chunk with clicked word
      const leftChunk = manualChunks[leftChunkIdx];
      const mergedStart = leftChunk.start;
      const mergedEnd = end;
      const mergedText = manualInput.substring(mergedStart, mergedEnd);
      newChunks[leftChunkIdx] = {
        ...leftChunk,
        end: mergedEnd,
        text: mergedText,
      };
    } else if (canMergeRight && rightChunkIdx !== -1) {
      // Merge right chunk with clicked word
      const rightChunk = manualChunks[rightChunkIdx];
      const mergedStart = start;
      const mergedEnd = rightChunk.end;
      const mergedText = manualInput.substring(mergedStart, mergedEnd);
      newChunks[rightChunkIdx] = {
        ...rightChunk,
        start: mergedStart,
        text: mergedText,
      };
    } else {
      // Create new single-word chunk
      newChunks.push({
        id: crypto.randomUUID(),
        start,
        end,
        text: wordText,
      });
    }

    newChunks.sort((a, b) => a.start - b.start);
    setManualChunks(newChunks);

    const newWords = newChunks.map((c) => ({
      id: c.id,
      targetWord: c.text.trim(),
      isCompleted: false,
    }));
    setWords(newWords);
  };

  const handleMouseUp = () => {
    if (importMode !== 'manual') return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const container = highlightContainerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    // Absoluten Start-Index berechnen, indem alles bis zum Klick geklont und gemessen wird
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(container);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    
    let start = preSelectionRange.toString().length;
    let end = start + range.toString().length;

    // Auto-Trim: Leerzeichen am Anfang und Ende ignorieren
    const selectedString = manualInput.substring(start, end);
    const trimStartOffset = selectedString.length - selectedString.trimStart().length;
    const trimEndOffset = selectedString.length - selectedString.trimEnd().length;

    start += trimStartOffset;
    end -= trimEndOffset;

    if (start >= end) {
      selection.removeAllRanges();
      return;
    }

    // Check overlap with existing chunks
    const hasOverlap = manualChunks.some(
      (chunk) => Math.max(start, chunk.start) < Math.min(end, chunk.end)
    );

    if (hasOverlap) {
      selection.removeAllRanges();
      return;
    }

    const chunkText = manualInput.substring(start, end);
    const newChunk = {
      id: crypto.randomUUID(),
      start,
      end,
      text: chunkText,
    };

    const updatedChunks = [...manualChunks, newChunk].sort((a, b) => a.start - b.start);
    setManualChunks(updatedChunks);

    // Sync to Zustand store
    const newWords = updatedChunks.map(c => ({
      id: c.id,
      targetWord: c.text.trim(),
      isCompleted: false
    }));
    setWords(newWords);

    // Clear selection
    selection.removeAllRanges();
  };

  const handleDeleteChunk = (chunkId: string) => {
    const updatedChunks = manualChunks.filter(c => c.id !== chunkId);
    setManualChunks(updatedChunks);
    
    const newWords = updatedChunks.map(c => ({
      id: c.id,
      targetWord: c.text.trim(),
      isCompleted: false
    }));
    setWords(newWords);
  };

  const handleResetChunks = () => {
    setManualChunks([]);
    setWords([]);
  };

  const getStationStatus = (num: number): 'idle' | 'active' | 'done' => {
    const s = stationStates.get(num);
    if (!s) return 'idle';
    if (s.currentIndex >= words.length - 1 && s.peeks > 0) return 'done';
    return 'active';
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-900">
      {connectionWarning && (
        <div className="bg-red-500 text-white text-center py-2 text-sm font-medium z-50">
          Verbindung zum Server verloren. Echtzeit-Updates sind derzeit nicht möglich.
        </div>
      )}
      <header className="py-4 px-8 border-b border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-950 flex items-center justify-between z-10">
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/')}
            className="mr-3 p-2 -ml-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer"
            title="Zurück zur Startseite"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-darkteal-800 dark:text-white">Lehrer-Dashboard</h1>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-8">
          {(['IMPORT', 'SETTINGS', 'LOBBY', 'LIVE'] as DashboardStep[]).map((step) => {
            const label = step === 'IMPORT' ? 'Import' : step === 'SETTINGS' ? 'Settings' : step === 'LOBBY' ? 'Lobby' : 'Live';
            const isActive = currentStep === step;
            const isSelectable = step === 'IMPORT' || words.length > 0;
            
            return (
              <button
                key={step}
                onClick={() => {
                  if (isSelectable) {
                    if (step === 'IMPORT') {
                      setCurrentStep('IMPORT');
                    } else if (step === 'SETTINGS') {
                      setCurrentStep('SETTINGS');
                    } else if (step === 'LOBBY') {
                      handleOpenLobby();
                    } else if (step === 'LIVE') {
                      setCurrentStep('LIVE');
                    }
                  }
                }}
                disabled={!isSelectable}
                className={`relative py-4 px-1 text-sm font-semibold transition-all border-b-2 cursor-pointer disabled:cursor-not-allowed ${
                  isActive 
                    ? 'border-brand-500 text-darkteal-800 dark:text-white' 
                    : 'border-transparent text-slate-400 dark:text-slate-650 hover:text-slate-600 dark:hover:text-slate-400 disabled:opacity-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* User profile icon */}
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>
         <main className="flex-1 p-4 sm:p-8">
         <div className="max-w-5xl mx-auto w-full flex flex-col gap-6 sm:gap-8 transition-all duration-300">
          {currentStep === 'IMPORT' && (
            <section className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-850 animate-in fade-in slide-in-from-bottom-4 duration-500 md:h-[950px] min-h-[800px] flex flex-col justify-between">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-850">
                <div>
                  <h2 className="text-2xl font-bold text-darkteal-800 dark:text-white">
                    1. Wortliste &amp; Text vorbereiten
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Gib deinen Text ein und wähle die Art der automatischen Aufteilung oder markiere Chunks manuell.
                  </p>
                </div>
                
                {/* File Upload Button */}
                <div className="relative">
                  <label className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-darkteal-800 dark:border-brand-500 text-darkteal-800 dark:text-brand-400 rounded-xl text-sm font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <FileText className="w-4 h-4" />
                    Datei hochladen (.csv, .txt)
                    <input 
                      type="file" 
                      accept=".csv, .txt" 
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Toolbar - Mode Toggles */}
              <div className="flex p-1 bg-[#e1edf9] dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 mb-6 max-w-fit">
                <button
                  type="button"
                  onClick={() => handleImportModeChange('sentences')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer ${
                    importMode === 'sentences'
                      ? 'bg-darkteal-800 text-white shadow-sm'
                      : 'text-darkteal-800 dark:text-slate-400 hover:text-[#053040]'
                  }`}
                >
                  <Type className="w-4 h-4" />
                  <span>Automatisch (Sätze)</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleImportModeChange('lines')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer ${
                    importMode === 'lines'
                      ? 'bg-darkteal-800 text-white shadow-sm'
                      : 'text-darkteal-800 dark:text-slate-400 hover:text-[#053040]'
                  }`}
                >
                  <ListRestart className="w-4 h-4" />
                  <span>Automatisch (Zeilen)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleImportModeChange('manual')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer ${
                    importMode === 'manual'
                      ? 'bg-darkteal-800 text-white shadow-sm'
                      : 'text-darkteal-800 dark:text-slate-400 hover:text-[#053040]'
                  }`}
                >
                  <Highlighter className="w-4 h-4" />
                  <span>Manuell (Highlighting)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch flex-1 min-h-0 mb-6">
                
                {/* Left Column - Input / Highlighter (Col span 7) */}
                <div className="md:col-span-7 flex flex-col gap-3 flex-1 min-h-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                      Highlighter-Feld
                    </span>
                    {importMode === 'manual' && words.length > 0 && (
                      <span className="text-xs font-semibold text-[#00c080]">
                        {words.length} {words.length === 1 ? 'Segment' : 'Segmente'} markiert
                      </span>
                    )}
                  </div>

                  {importMode === 'manual' ? (
                    /* Manual highlighting reader view */
                    manualInput.trim() === '' ? (
                      <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-205 dark:border-slate-800 rounded-xl min-h-[16rem]">
                        <span className="text-3xl mb-2">✍️</span>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kein Text vorhanden</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[280px]">
                          Wechsle zu Sätze oder Zeilen, um Text einzugeben, bevor du markierst.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleImportModeChange('sentences')}
                          className="mt-3 px-3 py-1.5 bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-bold hover:bg-brand-200 cursor-pointer transition-colors"
                        >
                          Modus wechseln
                        </button>
                      </div>
                    ) : (
                      <div className="relative flex flex-col flex-1 min-h-0">
                        <div 
                          ref={highlightContainerRef}
                          onMouseUp={handleMouseUp}
                          className="w-full flex-1 min-h-[16rem] overflow-y-auto p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 font-sans leading-relaxed text-lg select-text break-words whitespace-pre-wrap border-l-4 border-l-brand-500"
                        >
                          {getSegments().map((seg, idx) => {
                            if (seg.isHighlighted) {
                              return (
                                <span
                                  key={seg.chunkId}
                                  onClick={() => handleDeleteChunk(seg.chunkId!)}
                                  className="inline-block bg-[#5efcc2] dark:bg-[#5efcc2]/90 text-[#004730] rounded-lg px-2 py-0.5 mx-0.5 font-bold cursor-pointer hover:bg-red-100 hover:text-red-800 transition-colors group relative"
                                  title="Klicken zum Löschen"
                                >
                                  {seg.text}
                                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                                    ×
                                  </span>
                                </span>
                              );
                            } else {
                              return (
                                <React.Fragment key={idx}>
                                  {tokenizeText(seg.text, seg.start).map((tok, tIdx) => {
                                    if (tok.isWord) {
                                      return (
                                        <span
                                          key={tIdx}
                                          onClick={() => handleWordClick(tok.start, tok.end, tok.text)}
                                          className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 px-0.5 rounded transition-all duration-100 text-slate-800 dark:text-slate-200"
                                        >
                                          {tok.text}
                                        </span>
                                      );
                                    } else {
                                      return <span key={tIdx} className="text-slate-800 dark:text-slate-200">{tok.text}</span>;
                                    }
                                  })}
                                </React.Fragment>
                              );
                            }
                          })}
                        </div>
                        
                        {/* Info Banner at the bottom */}
                        <div className="mt-3 py-2.5 px-4 bg-[#f0f5fa] dark:bg-slate-900/65 rounded-full inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 self-start">
                          <Info className="w-3.5 h-3.5 text-brand-500" />
                          <span>Klicke auf Wörter, um sie zu Chunks zu verbinden.</span>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0">
                      <textarea
                        value={manualInput}
                        onChange={handleManualInputChange}
                        className="w-full flex-1 min-h-[16rem] p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:text-white resize-none font-sans leading-relaxed text-lg outline-none border-l-4 border-l-brand-500"
                        placeholder={
                          importMode === 'sentences' 
                            ? "Der schnelle Fuchs springt. Der Hund schläft." 
                            : "Elefant\nGiraffe\nNashorn"
                        }
                      />
                      <div className="mt-3 py-2.5 px-4 bg-[#f0f5fa] dark:bg-slate-900/65 rounded-full inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 self-start">
                        <Info className="w-3.5 h-3.5 text-brand-500" />
                        <span>
                          {importMode === 'sentences'
                            ? "Text wird automatisch bei Sätzen (. ! ?) in Chunks aufgeteilt."
                            : "Jede Zeile wird als eigener Chunk interpretiert (optional mit Semikolon für Hinweise: Wort;Hinweis)."}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-5 flex flex-col gap-3 flex-1 min-h-0">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                    Generierte Chunks
                  </span>

                  <div className="bg-[#f0f4f9] dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl p-5 flex-1 min-h-[16rem] overflow-y-auto flex flex-col justify-between">
                    {words.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-450 dark:text-slate-500">
                        <Sparkles className="w-8 h-8 mb-2 text-slate-350 dark:text-slate-750" />
                        <p className="text-xs font-semibold">Keine Chunks geladen</p>
                        <p className="text-[10px] mt-0.5">
                          {importMode === 'manual' 
                            ? "Klicke auf Wörter im Textfeld links." 
                            : "Gib Text im linken Feld ein."}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 content-start overflow-y-auto mb-4">
                          {words.map((word, idx) => (
                            <div 
                              key={word.id} 
                              className="flex items-center gap-1.5 bg-[#5efcc2] dark:bg-[#5efcc2]/90 text-[#004730] px-3 py-1.5 rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.02)] text-sm font-bold"
                            >
                              <span className="opacity-55 text-xs font-mono">{idx + 1}.</span>
                              <span className="break-all">{word.targetWord}</span>
                              <button 
                                onClick={() => handleDeleteChunk(word.id)}
                                className="hover:bg-[#004730]/10 text-[#004730] ml-1 p-0.5 rounded transition-colors cursor-pointer"
                                title="Chunk löschen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        
                        {/* Clear all chunks button */}
                        <button
                          type="button"
                          onClick={handleResetChunks}
                          className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-400 hover:text-red-500 transition-colors w-full border-t border-slate-200/50 dark:border-slate-800/50 pt-3 mt-auto cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Alle löschen</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </div>
              
              {/* Footer navigation */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
                <button 
                  onClick={() => navigate('/')}
                  className="flex items-center gap-1 text-darkteal-800 hover:text-brand-500 dark:text-slate-400 dark:hover:text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                
                {/* Stepper Dots (Schritt 1 von 3) */}
                <div className="bg-[#e6effa] dark:bg-slate-900 rounded-full py-1.5 px-4 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-darkteal-800 dark:bg-white" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1] dark:bg-slate-750" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1] dark:bg-slate-750" />
                  <span className="ml-1 text-[11px]">Schritt 1 von 3</span>
                </div>
                
                <button 
                  onClick={() => setCurrentStep('SETTINGS')}
                  disabled={words.length === 0}
                  className="px-6 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-450 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] disabled:scale-100"
                >
                  <span>Weiter zur Konfiguration</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          {/* Schritt 2: SETTINGS */}
          {currentStep === 'SETTINGS' && (
            <section className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-850 animate-in fade-in slide-in-from-bottom-4 duration-500 md:h-[950px] min-h-[800px] flex flex-col justify-between">
              <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-850">
                <h2 className="text-2xl font-bold text-darkteal-800 dark:text-white">
                  2. Spielmodus &amp; Optionen
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Konfigurieren Sie das Diktat-Erlebnis für Ihre Klasse.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch flex-1 min-h-0 mb-6">
                
                {/* Left Column (Col span 7) */}
                <div className="md:col-span-7 flex flex-col gap-6 md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-2">
                  
                  {/* Station Mode Toggle Card */}
                  <div className="p-5 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10 transition-all duration-300 shadow-sm">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-2xl font-bold">
                          📋
                        </div>
                        <div>
                          <span className="font-bold text-darkteal-800 dark:text-white block text-base">
                            Stations-Modus aktiv
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-450 mt-0.5 block leading-relaxed max-w-[280px]">
                            Papier-Diktat — Schüler schreiben auf Papier, Tablet/iPad zeigt nur Wörter.
                          </span>
                        </div>
                      </div>
                      
                      {/* Premium Green Toggle Switch */}
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={stationMode}
                          onChange={(e) => setStationMode(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-7 bg-slate-250 dark:bg-slate-800 peer-checked:bg-[#5efcc2] rounded-full transition-colors duration-250"></div>
                        <div className="absolute left-1 top-1 w-5 h-5 bg-white dark:bg-slate-100 rounded-full shadow-md transition-transform duration-250 peer-checked:translate-x-5 peer-checked:bg-[#004730]"></div>
                      </div>
                    </label>
                    
                    {stationMode && (
                      <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30 animate-in fade-in duration-300">
                        <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-450 mb-2 uppercase tracking-wider">
                          Anzahl der Schüler / Stationen
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={stationCount}
                            onChange={(e) => setStationCount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24 text-center font-bold py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none dark:text-white"
                          />
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            (Erstellt Nummernfelder für die Schüler)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mode Selector */}
                  <div className="flex flex-col gap-3">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                      Wählen Sie den Modus
                    </span>
                    
                    <div className={`space-y-3 transition-all duration-300 ${stationMode ? 'opacity-40 pointer-events-none' : ''}`}>
                      {([
                        {
                          id: 'LAUFDIKTAT',
                          name: 'Klassisches Laufdiktat',
                          desc: 'Der klassische Ablauf. Mit haptischer Barriere (2-Finger-Touch) zum Einprägen und direktem Tippen der Wörter.',
                          icon: '🏃‍♂️'
                        },
                        {
                          id: 'UEBUNG',
                          name: 'Freie Übung (ohne Stress)',
                          desc: 'Übungsmodus mit Unterstützung wie Text-to-Speech (Vorlesen) und Hilfestellungen bei Fehlern.',
                          icon: '📖'
                        },
                        {
                          id: 'BATTLE',
                          name: 'Battle-Modus (Multiplayer)',
                          desc: 'Spiele im Team oder gegeneinander! Aktiviert Störangriffe wie Tintenflecken und Bildschirmflimmern.',
                          icon: '⚔️'
                        }
                      ] as Array<{ id: GameMode; name: string; desc: string; icon: string }>).map((mode) => {
                        const isSelected = gameMode === mode.id && !stationMode;
                        return (
                          <div
                            key={mode.id}
                            onClick={() => {
                              if (!stationMode) setGameMode(mode.id);
                            }}
                            className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 ${
                              isSelected
                                ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/10 shadow-sm'
                                : 'border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-900'
                            }`}
                          >
                            {/* Checkbox / Radio Circle */}
                            <div className="mt-1 flex items-center justify-center">
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                isSelected 
                                  ? 'border-brand-500 bg-brand-500 text-white font-bold' 
                                  : 'border-slate-350 dark:border-slate-700'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </div>
                            
                            <div className="flex-1">
                              <span className="font-bold text-darkteal-800 dark:text-white flex items-center gap-2">
                                <span className="text-lg">{mode.icon}</span>
                                {mode.name}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-450 block mt-1 leading-relaxed">
                                {mode.desc}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Right Column (Col span 5) */}
                <div className="md:col-span-5 flex flex-col md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-3 block">
                    Modus-Optionen
                  </span>
                  
                  {!stationMode && gameMode === 'BATTLE' ? (
                    <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl p-5 flex flex-col h-full animate-in fade-in duration-300 shadow-sm">
                      <div className="flex items-center gap-2.5 mb-4 text-amber-800 dark:text-amber-450">
                        <Sparkles className="w-5 h-5 text-amber-600" />
                        <h3 className="font-bold text-sm uppercase tracking-wide">Battle-Optionen</h3>
                      </div>
                      
                      <div className="space-y-4">
                        {[
                          {
                            key: 'ink',
                            label: 'Tintenfleck-Angriff',
                            desc: 'Sichtverschleierung durch zufällige Tintenflecke auf dem Eingabebildschirm.',
                          },
                          {
                            key: 'flicker',
                            label: 'Flimmern-Angriff',
                            desc: 'Ablenkung durch periodisches Bildschirmflimmern während des Einprägens.',
                          }
                        ].map((opt) => (
                          <label key={opt.key} className="flex items-start gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={battleOptions[opt.key as keyof typeof battleOptions] || false}
                              onChange={(e) => setBattleOptions({ [opt.key]: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="mt-1 w-5 h-5 rounded-lg border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center transition-all peer-checked:border-brand-500 peer-checked:bg-brand-500 text-white">
                              <Check className="w-3.5 h-3.5 opacity-0 peer-checked:opacity-100 stroke-[3]" />
                            </div>
                            <div>
                              <span className="font-bold text-sm text-darkteal-800 dark:text-white block group-hover:text-brand-500 transition-colors">
                                {opt.label}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-450 block mt-0.5 leading-relaxed">
                                {opt.desc}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#f0f4f9] dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center text-center h-full min-h-[12rem]">
                      <div className="w-12 h-12 rounded-full bg-slate-200/50 dark:bg-slate-800/80 flex items-center justify-center mb-3">
                        <HelpCircle className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                      </div>
                      <p className="text-xs font-semibold text-slate-650 dark:text-slate-300 max-w-[200px] leading-relaxed">
                        Wählen Sie den Battle-Modus aus, um zusätzliche Optionen anzuzeigen.
                      </p>
                      {stationMode && (
                        <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-2 max-w-[200px]">
                          Im Stations-Modus sind Multiplayer-Optionen deaktiviert.
                        </p>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Step 2 Bottom Actions */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
                <button 
                  onClick={() => setCurrentStep('IMPORT')}
                  className="flex items-center gap-1 text-darkteal-800 hover:text-brand-500 dark:text-slate-400 dark:hover:text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Zurück</span>
                </button>
                
                {/* Stepper Dots (Schritt 2 von 3) */}
                <div className="bg-[#e6effa] dark:bg-slate-900 rounded-full py-1.5 px-4 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1] dark:bg-slate-750" />
                  <span className="w-2.5 h-2.5 rounded-full bg-darkteal-800 dark:bg-white" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1] dark:bg-slate-750" />
                  <span className="ml-1 text-[11px]">Schritt 2 von 3</span>
                </div>
                
                <button 
                  onClick={handleOpenLobby}
                  className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Lobby öffnen</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          {/* Schritt 3: LOBBY */}
          {currentStep === 'LOBBY' && (
            <section className="bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-850 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center flex flex-col justify-between items-center md:h-[950px] min-h-[800px]">
              
              {/* Top part: Header, QR Code & Room Code */}
              <div className="flex flex-col items-center w-full">
                <h2 className="text-2xl font-bold text-darkteal-800 dark:text-white">
                  3. Lobby (Warten auf Schüler)
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-455 mt-1 mb-6 max-w-md">
                  Lass deine Schüler diesen QR-Code scannen oder den Code eingeben, um beizutreten.
                </p>
                
                {stationMode && (
                  <span className="inline-flex items-center gap-1.5 bg-[#e5fff5] dark:bg-emerald-950/30 text-[#004730] dark:text-[#5efcc2] text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-emerald-200/30">
                    <span>📋</span> Stations-Modus aktiv
                  </span>
                )}
                
                <div className="bg-white dark:bg-white p-4 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-slate-100 mb-6">
                  <QRCodeSVG 
                    value={`${window.location.origin}/?room=${roomCode}`} 
                    size={160}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                {/* Premium Room Code Card */}
                <div className="bg-[#f0f5fa] dark:bg-slate-900 border border-slate-150/40 dark:border-slate-850 px-8 py-2 rounded-2xl mb-6 flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Raum-Code
                  </span>
                  <p className="text-4xl font-mono font-black tracking-[0.2em] text-brand-500 pl-[0.2em]">
                    {roomCode}
                  </p>
                </div>
              </div>

              {/* Middle part: Waiting Participants (flex-grow + scrollable) */}
              <div className="w-full bg-[#f4f6fa] dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-100 dark:border-slate-850/80 flex-1 min-h-0 overflow-y-auto mb-6">
                <h3 className="font-bold text-base text-darkteal-800 dark:text-white mb-4 flex items-center justify-center gap-2">
                  <span>Wartende Teilnehmer</span>
                  <span className="bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 py-0.5 px-3 rounded-full text-xs font-extrabold">
                    {studentsInLobby.length}
                  </span>
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {studentsInLobby.map((name, i) => (
                    <div 
                      key={i} 
                      className="bg-white dark:bg-slate-800 border border-slate-150/50 dark:border-slate-700 text-slate-700 dark:text-slate-350 py-2.5 px-4 rounded-xl font-bold text-sm shadow-[0_2px_4px_rgba(0,0,0,0.01)] animate-in zoom-in-95 duration-200"
                    >
                      {name}
                    </div>
                  ))}
                  {studentsInLobby.length === 0 && (
                    <div className="col-span-full text-slate-400 dark:text-slate-555 italic py-4 text-xs">
                      Noch niemand hier...
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom part: Footer Buttons */}
              <div className="w-full flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleEndSession}
                  className="px-6 py-3.5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-bold text-sm transition-all w-full sm:w-auto cursor-pointer"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleStartSession}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-base py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{stationMode ? 'Stationen starten' : 'Diktat jetzt starten'}</span>
                  <span className="text-xl">🚀</span>
                </button>
              </div>
            </section>
          )}

          {/* Schritt 4: LIVE */}
          {currentStep === 'LIVE' && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
              {/* Live Header */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-darkteal-800 dark:text-white">Lehrer-Dashboard</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      LIVE SESSION
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Raum-Code: <span className="font-mono font-bold text-darkteal-800 dark:text-white">{roomCode}</span>
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleEndSession}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  <XCircle className="w-4 h-4" />
                  Sitzung beenden
                </button>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Status Card */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-8 sm:p-10 flex flex-col items-center justify-center text-center min-h-[320px]">
                  {/* Runner Scene Info-Box */}
                  <div className="w-full max-w-md mx-auto mb-8 bg-slate-50/80 dark:bg-slate-900/40 rounded-2xl p-6 border border-slate-100 dark:border-slate-850 flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.015)]">
                    {/* Left Icon (Desk / Laptop) */}
                    <div className="text-2xl w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-750 select-none shrink-0">
                      💻
                    </div>

                    {/* Running Track */}
                    <div className="flex-1 mx-4 h-12 relative border-b-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-start overflow-hidden">
                      <div className="animate-run-ping-pong absolute left-0 bottom-1 text-3xl select-none leading-none">
                        🏃‍♂️
                      </div>
                    </div>

                    {/* Right Icon (Clipboard) */}
                    <div className="text-2xl w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-750 select-none shrink-0">
                      📋
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-darkteal-800 dark:text-white">
                    Das Diktat läuft...
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed">
                    Die Schüler pendeln zwischen Station und Platz.
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="w-full max-w-md mt-8">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${studentsInLobby.length > 0 ? Math.round((results.length / studentsInLobby.length) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-2 text-right">
                      {studentsInLobby.length > 0 ? Math.round((results.length / studentsInLobby.length) * 100) : 0}% Gesamtfortschritt
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  {/* Live-Statistik */}
                  <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-5">
                    <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-4">Live-Statistik</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100/50 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Aktiv</span>
                        <span className="text-3xl font-black text-darkteal-800 dark:text-white">
                          {stationMode
                            ? Array.from({ length: stationCount }, (_, i) => i + 1).filter(n => getStationStatus(n) === 'active').length
                            : Math.max(0, studentsInLobby.length - results.length)
                          }
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100/50 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Abgeschlossen</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                          {stationMode
                            ? Array.from({ length: stationCount }, (_, i) => i + 1).filter(n => getStationStatus(n) === 'done').length
                            : results.length
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Letzte Ereignisse */}
                  <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-5 flex-1 min-h-[180px]">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Letzte Ereignisse</h4>
                      <Activity className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                    </div>
                    <div className="space-y-3.5">
                      {results.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-600 italic py-6 text-center">Noch keine Ereignisse...</p>
                      ) : (
                        results.slice(-3).reverse().map((r, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-darkteal-800 dark:text-white leading-tight">{r.name || 'Teilnehmer'} hat abgeschlossen</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Score: {r.score.toFixed(2)} · {r.peeks} Spicker</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schüler Übersicht */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-darkteal-800 dark:text-white">Schüler Übersicht</h3>
                </div>
                
                {stationMode ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {Array.from({ length: stationCount }, (_, i) => i + 1).map((num) => {
                      const status = getStationStatus(num);
                      const state = stationStates.get(num);
                      const progress = state ? Math.round(((state.currentIndex + 1) / words.length) * 100) : 0;
                      return (
                        <div
                          key={num}
                          className={`rounded-2xl border p-4 flex flex-col items-center text-center transition-all duration-300 ${
                            status === 'done'
                              ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/10'
                              : status === 'active'
                              ? 'border-brand-200 dark:border-brand-800/50 bg-brand-50/30 dark:bg-brand-950/10 station-pulse'
                              : 'border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className={`text-2xl font-black mb-1 ${
                            status === 'done' ? 'text-emerald-600 dark:text-emerald-400'
                              : status === 'active' ? 'text-brand-600 dark:text-brand-400'
                              : 'text-slate-300 dark:text-slate-700'
                          }`}>
                            {num}
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {status === 'done' ? 'Fertig' : status === 'active' ? `Wort ${(state?.currentIndex ?? 0) + 1}/${words.length}` : 'Inaktiv'}
                          </span>
                          <div className="w-full mt-2 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                status === 'done' ? 'bg-emerald-500' : status === 'active' ? 'bg-brand-500' : 'bg-transparent'
                              }`}
                              style={{ width: status === 'done' ? '100%' : `${progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {studentsInLobby.map((name, i) => {
                      const result = results.find(r => r.name === name);
                      const isFinished = !!result;
                      return (
                        <div 
                          key={i}
                          className={`rounded-2xl border p-4 flex flex-col items-center text-center transition-all ${
                            isFinished 
                              ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/10' 
                              : 'border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <AnimalAvatar studentName={name} className="w-14 h-14 mb-2" />
                          <span className="text-sm font-bold text-darkteal-800 dark:text-white truncate w-full">{name}</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                            {isFinished ? 'Fertig' : 'Aktiv'}
                          </span>
                          <div className="w-full mt-2 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${isFinished ? 'bg-emerald-500' : 'bg-brand-500'}`}
                              style={{ width: isFinished ? '100%' : '33%' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {studentsInLobby.length === 0 && (
                      <div className="col-span-full text-center py-8">
                        <p className="text-sm text-slate-400 dark:text-slate-500 italic">Noch keine Schüler beigetreten...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
};
