/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'serbisyo-toledo-theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

const ThemeContext = createContext(null);

const getSystemTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return THEME_LIGHT;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
};

const getStoredTheme = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === THEME_LIGHT || stored === THEME_DARK) {
    return stored;
  }

  return null;
};

const applyThemeToDocument = (theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-bs-theme', theme);
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getStoredTheme() || getSystemTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleMediaChange = () => {
      const stored = getStoredTheme();
      if (!stored) {
        setTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }

      if (event.newValue === THEME_LIGHT || event.newValue === THEME_DARK) {
        setTheme(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === THEME_DARK ? THEME_LIGHT : THEME_DARK));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === THEME_DARK,
      setTheme,
      toggleTheme,
      storageKey: STORAGE_KEY,
    }),
    [theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
