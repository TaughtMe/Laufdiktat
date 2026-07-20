import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Färbt die Bestätigung als zerstörerische Aktion ein. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Bestätigungsdialog im Dashboard-Look. Ersetzt window.confirm, das im Projekt
 * bewusst nirgends verwendet wird.
 *
 * Kartenrezept aus DashboardOnboarding, Dialog-Semantik (role/aria-modal,
 * Backdrop-Klick, Schließen-Taste) aus RoomQrOverlay – zusätzlich Escape und
 * Anfangsfokus auf der Abbrechen-Schaltfläche, damit ein versehentliches Enter
 * nichts löscht.
 */
export const ConfirmDialog = ({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[22px] border border-line bg-surface p-6 shadow-2xl"
      >
        <h3 className="text-[17px] font-extrabold text-ink">{title}</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{description}</p>

        <div className="mt-6 flex gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-xl bg-surface-2 py-3 text-sm font-bold text-ink-muted
              transition-colors hover:text-ink"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 cursor-pointer rounded-xl py-3 text-sm font-bold text-white shadow-md
              transition-all active:scale-[0.98] hover:opacity-90 ${destructive ? 'bg-danger' : 'bg-accent'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
