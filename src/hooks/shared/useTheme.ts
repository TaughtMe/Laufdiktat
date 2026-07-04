import { useEffect, useState } from 'react';
import { isDarkTheme, subscribeTheme, toggleTheme } from '../../theme';

/** React-Anbindung an das Theme-Modul (src/theme.ts). */
export const useTheme = () => {
  const [dark, setDark] = useState(isDarkTheme);

  useEffect(() => subscribeTheme(setDark), []);

  return { dark, toggleTheme };
};
