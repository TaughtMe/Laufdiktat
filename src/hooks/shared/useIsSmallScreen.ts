import { useEffect, useState } from 'react';

// Unter dieser Breite gilt ein Gerät als "zu klein" fürs Lehrer-Dashboard.
// Ein Handy im Querformat liegt i. d. R. bereits darüber (z. B. 812px breit),
// die Empfehlung "Querformat" wird damit ohne Zusatzlogik automatisch erfüllt.
const QUERY = '(max-width: 767px)';

/** Reines UI-Signal (kein Fach-/Spiellogik-Zweck), ob der Viewport schmal ist. */
export const useIsSmallScreen = (): boolean => {
  const [isSmall, setIsSmall] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handleChange = (e: MediaQueryListEvent) => setIsSmall(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isSmall;
};
