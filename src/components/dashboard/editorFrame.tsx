import type { ReactNode, UIEvent } from 'react';

/**
 * Gemeinsame Grundlage der beiden Editor-Zustände (Mirror-Editor und
 * Marker-Ansicht).
 *
 * Warum das hier zentral liegt: Spiegel-Ebene, Textarea und Marker-Ansicht
 * müssen in Typografie UND Boxmodell exakt übereinstimmen – sonst laufen die
 * Zeilenumbrüche auseinander und die Einfärbung sitzt neben dem Text. Eine
 * einzige Konstante statt dreimal von Hand gleichgehaltener Klassenlisten.
 *
 * 16px (nicht die 15px der Designvorlage): Unterhalb von 16px zoomt iOS beim
 * Fokussieren eines Eingabefeldes automatisch hinein, und das Viewport-Meta
 * unterbindet das bewusst nicht (`user-scalable` bleibt erlaubt – Zoom ist eine
 * Barrierefreiheits-Funktion). Auf den Schul-iPads ist der Sprung sonst deutlich
 * störender als der minimale Größenunterschied.
 */
export const EDITOR_TEXT_CLASSES =
  'box-border px-4 py-3.5 font-sans text-[16px] leading-[1.7] tracking-normal ' +
  'whitespace-pre-wrap break-words [overflow-wrap:anywhere] [tab-size:4]';

/**
 * Mindesthöhe – identisch für Rahmen, Textarea und Marker-Ansicht. Die Textarea
 * braucht sie, damit sie den Rahmen auch bei wenig Text ausfüllt: sonst liegt
 * unter ihr eine tote Fläche, in die man klicken kann, ohne dass der Cursor
 * gesetzt wird.
 */
export const EDITOR_MIN_HEIGHT = 'min-h-[13rem]';

/**
 * Abschnitts-Hervorhebung, geteilt von Mirror-Editor und Marker-Ansicht.
 *
 * Ausschließlich Hintergrund und Outline – kein Padding, kein Margin, kein
 * platzeinnehmender Rahmen. Jede dieser Eigenschaften würde den Text gegenüber
 * der Textarea darunter verschieben und beim Moduswechsel einen sichtbaren
 * Sprung erzeugen. `box-decoration-break: clone` färbt über mehrere Zeilen
 * umbrechende Abschnitte auf jeder Zeile sauber ein.
 */
const CLONE = '[box-decoration-break:clone] [-webkit-box-decoration-break:clone] rounded-[0.2rem]';

/** Automatische Abschnitte: dezent, abwechselnd zur Unterscheidung benachbarter. */
export const SEGMENT_AUTO_EVEN = `bg-accent/10 ${CLONE}`;
export const SEGMENT_AUTO_ODD = `bg-accent/20 ${CLONE}`;
/** Manuelle Abschnitte: deutlicher, zusätzlich gestrichelte Outline. */
export const SEGMENT_MANUAL = `bg-accent/30 [outline:1px_dashed_var(--color-accent-strong)] ${CLONE}`;

interface EditorFrameProps {
  children: ReactNode;
  /** Hebt den Rahmen hervor, solange der Marker aktiv ist. */
  highlighted?: boolean;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}

/**
 * Der scrollende Rahmen. Er bleibt beim Wechsel zwischen Mirror-Editor und
 * Marker-Ansicht MONTIERT – dadurch bleibt die Scrollposition erhalten und es
 * gibt konstruktionsbedingt keinen Layout-Sprung.
 *
 * Bewusst scrollt der Rahmen, nicht die Textarea: Sobald die Textarea eine
 * eigene Scrollbar bekäme, wäre ihre Inhaltsbreite schmaler als die der
 * Spiegel-Ebene und die Zeilenumbrüche der beiden Ebenen würden auseinander-
 * laufen. So hat nur eine Ebene eine Scrollbar und beide sind immer gleich breit.
 */
export const EditorFrame = ({ children, highlighted = false, onScroll }: EditorFrameProps) => (
  <div
    onScroll={onScroll}
    className={`relative w-full ${EDITOR_MIN_HEIGHT} max-h-[26rem] overflow-y-auto rounded-[14px] border bg-surface-2 transition-colors ${
      highlighted ? 'border-accent' : 'border-line'
    }`}
  >
    {children}
  </div>
);
