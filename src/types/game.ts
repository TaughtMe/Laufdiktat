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
