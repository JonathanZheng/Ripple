import React, { createContext, useContext, ReactNode } from 'react';

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

interface ThemeContextType {
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({ colors: DARK_COLORS });

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors: DARK_COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
 