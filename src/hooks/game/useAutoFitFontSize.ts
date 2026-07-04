import { useLayoutEffect, useRef, useState } from 'react';

interface Options {
  /** Kleinste erlaubte Schriftgröße in px (für sehr lange Texte). */
  min: number;
  /** Größte erlaubte Schriftgröße in px (für kurze Texte). */
  max: number;
  /** Schrittweite beim Verkleinern in px. */
  step?: number;
}

/**
 * Passt die Schriftgröße eines Textelements automatisch an seinen
 * verfügbaren Platz an: kurze Texte bleiben groß, lange Texte werden
 * verkleinert, bis sie in Breite UND Höhe des umgebenden Containers passen.
 * `containerRef` gehört auf ein Element mit fester Breite/Höhe (z. B. über
 * vw/vh), `textRef` auf das Textelement selbst.
 */
export const useAutoFitFontSize = (text: string, { min, max, step = 2 }: Options) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const [fontSize, setFontSize] = useState(max);

  // Bewusst OHNE spezifisches Dependency-Array (läuft nach jedem Render):
  // Container/Text-Element werden an anderer Stelle abhängig von einem
  // eigenen "sichtbar"-Zustand ein-/ausgeblendet (unmount/remount), der
  // NICHT zwangsläufig gleichzeitig mit `text` wechselt. Ein Dependency-Array
  // auf nur `text` würde die Neuberechnung verpassen, wenn der Container erst
  // *nach* einer Textänderung (wieder) gemountet wird. Der Guard in
  // setFontSize verhindert eine Render-Schleife.
  useLayoutEffect(() => {
    const fit = () => {
      const container = containerRef.current;
      const el = textRef.current;
      if (!container || !el || !text) return;

      let size = max;
      el.style.fontSize = `${size}px`;
      // Schrittweise verkleinern, bis der Text in Breite UND Höhe passt.
      while (
        size > min &&
        (el.scrollWidth > container.clientWidth || el.scrollHeight > container.clientHeight)
      ) {
        size -= step;
        el.style.fontSize = `${size}px`;
      }
      setFontSize((prev) => (prev === size ? prev : size));
    };

    fit();
    // Bei Drehung/Größenänderung (z. B. Tablet quer/hoch) neu berechnen.
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });

  return { containerRef, textRef, fontSize };
};
