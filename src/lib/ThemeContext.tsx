import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  background: string;
  surface: string;
  surface2: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  divider: string;
  inputBg: string;
  inputBorder: string;
  inputBorderFocus: string;
  inputText: string;
  inputPlaceholder: string;
  inputIcon: string;
  labelColor: string;
  tabBar: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;
  tabActiveBg: string;
  primaryBg: string;
  primaryText: string;
  secondaryBg: string;
  secondaryBorder: string;
  secondaryText: string;
  ghostText: string;
  sectionLabel: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  chipSelectedBg: string;
  chipSelectedText: string;
}

export const DARK_COLORS: ThemeColors = {
  background: '#000000',
  surface: 'rgba(255,255,255,0.03)',
  surface2: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.50)',
  textFaint: 'rgba(255,255,255,0.30)',
  divider: 'rgba(255,255,255,0.05)',
  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(255,255,255,0.08)',
  inputBorderFocus: 'rgba(255,255,255,0.30)',
  inputText: '#ffffff',
  inputPlaceholder: 'rgba(255,255,255,0.22)',
  inputIcon: 'rgba(255,255,255,0.35)',
  labelColor: 'rgba(255,255,255,0.50)',
  tabBar: 'rgba(10,10,10,0.92)',
  tabBarBorder: 'rgba(255,255,255,0.08)',
  tabActive: '#ffffff',
  tabInactive: 'rgba(255,255,255,0.40)',
  tabActiveBg: 'rgba(255,255,255,0.10)',
  primaryBg: '#ffffff',
  primaryText: '#000000',
  secondaryBg: 'rgba(255,255,255,0.05)',
  secondaryBorder: 'rgba(255,255,255,0.15)',
  secondaryText: '#ffffff',
  ghostText: 'rgba(255,255,255,0.60)',
  sectionLabel: 'rgba(255,255,255,0.30)',
  chipBg: 'rgba(255,255,255,0.04)',
  chipBorder: 'rgba(255,255,255,0.10)',
  chipText: 'rgba(255,255,255,0.55)',
  chipSelectedBg: 'rgba(255,255,255,0.90)',
  chipSelectedText: '#000000',
};

export const LIGHT_COLORS: ThemeColors = {
  background: '#f0f0f0',
  surface: 'rgba(0,0,0,0.04)',
  surface2: 'rgba(0,0,0,0.07)',
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.15)',
  text: '#111111',
  textMuted: 'rgba(0,0,0,0.50)',
  textFaint: 'rgba(0,0,0,0.35)',
  divider: 'rgba(0,0,0,0.06)',
  inputBg: 'rgba(0,0,0,0.04)',
  inputBorder: 'rgba(0,0,0,0.10)',
  inputBorderFocus: 'rgba(0,0,0,0.35)',
  inputText: '#111111',
  inputPlaceholder: 'rgba(0,0,0,0.25)',
  inputIcon: 'rgba(0,0,0,0.35)',
  labelColor: 'rgba(0,0,0,0.50)',
  tabBar: 'rgba(240,240,240,0.95)',
  tabBarBorder: 'rgba(0,0,0,0.08)',
  tabActive: '#111111',
  tabInactive: 'rgba(0,0,0,0.35)',
  tabActiveBg: 'rgba(0,0,0,0.08)',
  primaryBg: '#111111',
  primaryText: '#ffffff',
  secondaryBg: 'rgba(0,0,0,0.05)',
  secondaryBorder: 'rgba(0,0,0,0.15)',
  secondaryText: '#111111',
  ghostText: 'rgba(0,0,0,0.55)',
  sectionLabel: 'rgba(0,0,0,0.35)',
  chipBg: 'rgba(0,0,0,0.04)',
  chipBorder: 'rgba(0,0,0,0.10)',
  chipText: 'rgba(0,0,0,0.55)',
  chipSelectedBg: 'rgba(0,0,0,0.85)',
  chipSelectedText: '#ffffff',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: DARK_COLORS,
  toggleTheme: () => {},
});

const STORAGE_KEY = 'ripple_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light') setIsDark(false);
    });
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    if (Platform.OS === 'web') {
      (document.documentElement as HTMLElement).setAttribute('data-theme', next ? 'dark' : 'light');
    }
  }

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? DARK_COLORS : LIGHT_COLORS, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
