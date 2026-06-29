export type GameState = 'IDLE' | 'REVEALED' | 'WRITING' | 'FINISHED';

export interface WordItem {
  id: string;
  /** Die akzeptierte Antwort. Bei Mathe das Ergebnis als String, z. B. "8". */
  targetWord: string;
  /**
   * Optional: was angezeigt wird, wenn es von der Antwort abweicht
   * (Mathe-Aufgabe, z. B. "4 + 4"). Ist es gesetzt, wird numerisch geprüft.
   */
  prompt?: string;
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

export type AttackType = 'ink' | 'flicker';

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
  uebungMaxAttempts: number;
}

