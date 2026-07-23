import { useEffect, useRef, useState } from 'react';
import { Download, HelpCircle } from 'lucide-react';
import type { ImportMode } from './ImportStep';
import { downloadTextFile } from '../../utils/dashboard/downloadFile';
import { MATH_TEMPLATE, TEXT_TEMPLATES, type ImportTemplate } from '../../utils/dashboard/importTemplates';

interface UploadHelpPopoverProps {
  importMode: ImportMode;
}

/**
 * Kleiner „?"-Button neben der Upload-Pill, der ein am Button verankertes
 * Popover öffnet: kurze Erklärung, wie der Upload funktioniert, plus die zum
 * Reiter passenden Beispiel-Vorlagen zum Download.
 *
 * Schließverhalten (Außenklick per document-mousedown + Ref-Ausschluss, dazu
 * Escape) folgt dem vorhandenen Muster aus MathSettingsPanel; inline, weil es
 * die einzige Popover-Stelle im Projekt ist.
 */
export const UploadHelpPopover = ({ importMode }: UploadHelpPopoverProps) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const templates: ImportTemplate[] = importMode === 'math' ? [MATH_TEMPLATE] : TEXT_TEMPLATES;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Hilfe zum Hochladen"
        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-colors ${
          open
            ? 'border-accent bg-accent-soft text-accent-strong'
            : 'border-line bg-surface text-ink-faint hover:bg-surface-2 hover:text-ink'
        }`}
      >
        <HelpCircle className="h-[17px] w-[17px]" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Hilfe zum Hochladen"
          className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[14px]
            border border-line bg-surface p-4 text-left shadow-lg"
        >
          {importMode === 'math' ? (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-[13px] font-extrabold text-ink">Aufgaben hochladen</h3>
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Eine Aufgabe pro Zeile, z. B. <code className="font-mono text-ink">4 + 4</code>,{' '}
                <code className="font-mono text-ink">20 : 4</code> oder{' '}
                <code className="font-mono text-ink">\frac&#123;1&#125;&#123;2&#125; + 3</code>. Erlaubt sind
                +, −, ·, : sowie Brüche, Potenzen und Wurzeln. Die Ergebnisse werden automatisch berechnet.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-[13px] font-extrabold text-ink">Text hochladen</h3>
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Einfach den Text einwerfen – wie er in Abschnitte zerlegt wird, steuerst du danach mit den
                Regeln „Zeichen“ und „Enter“. Je nach Struktur passt eine andere Vorlage:
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.filename}
                type="button"
                onClick={() => downloadTextFile(tpl.filename, tpl.content)}
                className="group flex items-start gap-2.5 rounded-[10px] border border-line bg-surface-2 p-2.5
                  text-left transition-colors hover:border-accent"
              >
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-accent-strong" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[12.5px] font-bold text-ink">{tpl.label}</span>
                  <span className="text-[11px] leading-relaxed text-ink-faint">{tpl.hint}</span>
                </span>
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            Format: .txt oder .csv – die Datei wird als reiner Text gelesen, eine Zeile ist ein Eintrag
            (keine Kopfzeile).
          </p>
        </div>
      )}
    </div>
  );
};
