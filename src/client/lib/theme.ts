import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
/** What the person chose; 'system' follows the phone or computer */
export type ThemeChoice = Theme | 'system';

const STORAGE_KEY = 'tailme-theme';

function storedChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' || v === 'light' ? v : 'system';
  } catch {
    return 'system';
  }
}

const systemDark = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const resolve = (choice: ThemeChoice): Theme => {
  if (choice !== 'system') return choice;
  return systemDark() ? 'dark' : 'light';
};

/** The page background (gray-950 in main.css), for the browser / app chrome */
const CHROME_COLORS: Record<Theme, string> = {
  light: '#f2f4f6',
  dark: '#030712',
};

/**
 * Sets the `dark` class on <html> (the palette in main.css follows it) and
 * the top-of-screen color. The theme-color tag is replaced, not edited:
 * Safari often doesn't repaint for an edited one. (public/theme-boot.js does
 * the same before the app loads.) The home-screen app's status bar can't be
 * changed from the page; iOS ties it to the phone's own setting, which is
 * why 'system' is the default.
 */
export function applyTheme(choice: ThemeChoice = storedChoice()) {
  const theme = resolve(choice);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const old = document.querySelector('meta[name="theme-color"]');
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = CHROME_COLORS[theme];
  if (old) old.replaceWith(meta);
  else document.head.appendChild(meta);
}

export default function useTheme() {
  const [choice, setChoiceState] = useState<ThemeChoice>(storedChoice);
  const [systemIsDark, setSystemIsDark] = useState(systemDark);

  // Following the phone: switch when it does (sunset auto-dark, etc.)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return undefined;
    const onChange = () => {
      setSystemIsDark(query.matches);
      if (storedChoice() === 'system') applyTheme('system');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    applyTheme(next);
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode etc.: the choice just won't persist
    }
  }, []);

  const systemTheme: Theme = systemIsDark ? 'dark' : 'light';
  const theme: Theme = choice === 'system' ? systemTheme : choice;

  const toggleTheme = useCallback(
    () => setChoice(theme === 'dark' ? 'light' : 'dark'),
    [theme, setChoice]
  );

  /** Pick light or dark outright (stops following the phone) */
  const setTheme = useCallback((next: Theme) => setChoice(next), [setChoice]);

  return { theme, choice, setTheme, setChoice, toggleTheme };
}
