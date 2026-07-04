import { Sparkles } from 'lucide-react';

/** Leerer-Zustand-Hinweis für Chip-/Aufgaben-Panels (Import-Step). */
export const EmptyChips = ({ text, sub }: { text: string; sub: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-ink-faint">
    <Sparkles className="w-7 h-7 mb-2 opacity-50" />
    <p className="text-xs font-bold">{text}</p>
    <p className="text-[10px] mt-0.5">{sub}</p>
  </div>
);
