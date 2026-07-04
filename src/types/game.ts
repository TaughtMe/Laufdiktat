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
  /**
   * Manuell eingegebene komplexere Mathe-Aufgabe (Bruch/Potenz/Wurzel via
   * LaTeX-ähnlicher Syntax, siehe utils/dashboard/latexMath.ts). Wenn
   * gesetzt, wird `prompt` per KaTeX gerendert statt als Klartext gezeigt.
   */
  isLatex?: boolean;
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
  /**
   * Einmal gesetzt (beim ersten Ansehen des letzten Wortes), bleibt es auf
   * true stehen – auch wenn der Schüler danach zurückblättert, um sich
   * frühere Sätze nochmal anzusehen. So zeigt das Lehrer-Dashboard "Fertig"
   * stabil an, statt bei jedem Zurückblättern wieder zu verschwinden.
   */
  finished?: boolean;
}

export interface SessionStartPayload {
  words: WordItem[];
  gameMode: GameMode;
  battleOptions: BattleOptions;
  stationMode: boolean;
  stationCount: number;
  uebungMaxAttempts: number;
}

