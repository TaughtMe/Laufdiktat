export type GameState = 'IDLE' | 'REVEALED' | 'WRITING' | 'FINISHED';

export interface WordItem {
  id: string;
  targetWord: string;
  isCompleted: boolean;
}

export interface GameMetrics {
  peeks: number;
  attempts: number;
}

export type GameMode = 'LAUFDIKTAT' | 'UEBUNG' | 'BATTLE';

export interface BattleOptions {
  ink: boolean;
  flicker: boolean;
}

export interface StationStudentState {
  currentIndex: number;
  peeks: number;
}

export interface SessionStartPayload {
  words: WordItem[];
  gameMode: GameMode;
  battleOptions: BattleOptions;
  stationMode: boolean;
  stationCount: number;
}

