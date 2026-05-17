import { create } from 'zustand';
import type { WordItem, GameMode, BattleOptions } from '../types/game';

interface GameStore {
  // State
  words: WordItem[];
  gameMode: GameMode;
  battleOptions: BattleOptions;
  bimanualLocked: boolean;
  
  // Actions
  setWords: (words: WordItem[]) => void;
  setGameMode: (mode: GameMode) => void;
  setBattleOptions: (options: Partial<BattleOptions>) => void;
  setBimanualLocked: (locked: boolean) => void;
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

  // Actions
  setWords: (words) => set({ words }),
  
  setGameMode: (gameMode) => set({ gameMode }),
  
  setBattleOptions: (options) => 
    set((state) => ({ 
      battleOptions: { ...state.battleOptions, ...options } 
    })),
  setBimanualLocked: (locked) => set({ bimanualLocked: locked }),
}));
