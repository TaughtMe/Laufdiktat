import { create } from 'zustand';
import type { WordItem, GameMode, BattleOptions } from '../types/game';

interface GameStore {
  // State
  words: WordItem[];
  gameMode: GameMode;
  battleOptions: BattleOptions;
  bimanualLocked: boolean;
  stationMode: boolean;
  stationCount: number;
  isTtsEnabled: boolean;
  uebungMaxAttempts: number;

  // Actions
  setWords: (words: WordItem[]) => void;
  setGameMode: (mode: GameMode) => void;
  setBattleOptions: (options: Partial<BattleOptions>) => void;
  setBimanualLocked: (locked: boolean) => void;
  setStationMode: (active: boolean) => void;
  setStationCount: (count: number) => void;
  toggleTts: () => void;
  setTtsEnabled: (enabled: boolean) => void;
  setUebungMaxAttempts: (count: number) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial State
  words: [],
  gameMode: 'LAUFDIKTAT',
  battleOptions: {
    ink: false,
    flicker: false,
  },
  bimanualLocked: false,
  stationMode: false,
  stationCount: 24,
  isTtsEnabled: true,
  uebungMaxAttempts: 3,

  // Actions
  setWords: (words) => set({ words }),
  
  setGameMode: (gameMode) => set({ gameMode }),
  
  setBattleOptions: (options) => 
    set((state) => ({ 
      battleOptions: { ...state.battleOptions, ...options } 
    })),
  setBimanualLocked: (locked) => set({ bimanualLocked: locked }),
  setStationMode: (active) => set({ stationMode: active }),
  setStationCount: (stationCount) => set({ stationCount }),
  toggleTts: () => set((state) => ({ isTtsEnabled: !state.isTtsEnabled })),
  setTtsEnabled: (isTtsEnabled) => set({ isTtsEnabled }),
  setUebungMaxAttempts: (uebungMaxAttempts) => set({ uebungMaxAttempts }),
}));
