import { useCallback, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tailme-theme';

function stored(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** The page background (gray-950 in main.css), for the browser / app chrome */
const CHROME_COLORS: Record<Theme, string> = {
  light: '#f2f4f6',
  dark: '#030712',
};

/** Sets the `dark` class on <html>; the palette in main.css follows it. */
export function applyTheme(theme: Theme = stored()) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', CHROME_COLORS[theme]);
}

export default function useTheme() {
  const [theme, setThemeState] = useState<Theme>(stored);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode etc.: the choice just won't persist
    }
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme]
  );

  return { theme, setTheme, toggleTheme };
}
