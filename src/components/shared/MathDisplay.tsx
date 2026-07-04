import { useMemo } from 'react';
import katex from 'katex';

interface MathDisplayProps {
  /** Anzuzeigender Text – bei isLatex=true als LaTeX-ähnliche Eingabe interpretiert. */
  text: string;
  /** Ob `text` per KaTeX gerendert werden soll (siehe WordItem.isLatex). */
  isLatex?: boolean;
  /** KaTeX-Displaymodus (größere, freistehende Darstellung) vs. Inline-Fluss. */
  displayMode?: boolean;
  className?: string;
}

/**
 * Zeigt einen Mathe-Text an: normalerweise als Klartext, bei komplexeren
 * manuell eingegebenen Aufgaben (Bruch/Potenz/Wurzel, `isLatex`) gerendert
 * per KaTeX. Rendert bei ungültigem LaTeX (kann bei freier Eingabe passieren)
 * defensiv den Rohtext statt abzustürzen.
 */
export const MathDisplay = ({ text, isLatex, displayMode = false, className }: MathDisplayProps) => {
  const html = useMemo(() => {
    if (!isLatex) return null;
    try {
      return katex.renderToString(text, { throwOnError: false, displayMode, strict: false });
    } catch {
      return null;
    }
  }, [text, isLatex, displayMode]);

  if (html) {
    // katex.renderToString liefert kontrolliertes, eigenes Markup (kein Nutzer-HTML).
    return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span className={className}>{text}</span>;
};
