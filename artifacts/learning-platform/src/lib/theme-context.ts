import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export const ThemeContext = createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
} | null>(null);

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('Theme controls must be used inside the learning app shell.');
  }
  return theme;
}