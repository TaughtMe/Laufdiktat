import { Link } from 'react-router-dom';

/**
 * Dezenter „Impressum & Datenschutz"-Link für den Fußbereich jeder Seite.
 * Öffnet in einem neuen Tab, damit ein laufendes Spiel nicht verlassen wird.
 * `dark` für helle Schrift auf dunklem Hintergrund (Spiel-Screens).
 */
export const LegalLink = ({ className = '', dark = false }: { className?: string; dark?: boolean }) => (
  <Link
    to="/legal"
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    onTouchStart={(e) => e.stopPropagation()}
    className={`text-[10px] font-medium transition-colors pointer-events-auto ${
      dark
        ? 'text-white/40 hover:text-white/70'
        : 'text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300'
    } ${className}`}
  >
    Impressum &amp; Datenschutz
  </Link>
);
