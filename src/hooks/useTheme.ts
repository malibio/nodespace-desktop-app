import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeHook {
  currentTheme: 'light' | 'dark';
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'nodespace-theme-preference';

/**
 * Hook for managing theme state with Tauri native OS integration
 * Supports manual override and automatic OS theme detection
 */
export function useTheme(): ThemeHook {
  // Load saved preference or default to 'auto'
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved as ThemeMode) || 'auto';
  });

  // Determine current effective theme
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    if (themeMode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return themeMode as 'light' | 'dark';
  });

  // Listen for OS theme changes when in auto mode
  useEffect(() => {
    if (themeMode !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setCurrentTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    
    // Set initial value
    setCurrentTheme(mediaQuery.matches ? 'dark' : 'light');

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  // Update current theme when mode changes
  useEffect(() => {
    if (themeMode === 'auto') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setCurrentTheme(isDark ? 'dark' : 'light');
    } else {
      setCurrentTheme(themeMode as 'light' | 'dark');
    }
  }, [themeMode]);

  // Apply theme classes to document body
  useEffect(() => {
    const body = document.body;
    
    // Remove existing theme classes
    body.classList.remove('ns-light-mode', 'ns-dark-mode');
    
    // Add current theme class
    body.classList.add(currentTheme === 'dark' ? 'ns-dark-mode' : 'ns-light-mode');
    
    return () => {
      body.classList.remove('ns-light-mode', 'ns-dark-mode');
    };
  }, [currentTheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  const toggleTheme = useCallback(() => {
    if (themeMode === 'auto') {
      // If auto, switch to opposite of current
      setThemeMode(currentTheme === 'dark' ? 'light' : 'dark');
    } else {
      // If manual, toggle between light/dark
      setThemeMode(currentTheme === 'dark' ? 'light' : 'dark');
    }
  }, [themeMode, currentTheme, setThemeMode]);

  return {
    currentTheme,
    themeMode,
    setThemeMode,
    toggleTheme,
  };
}