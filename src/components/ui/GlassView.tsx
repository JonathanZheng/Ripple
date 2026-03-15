import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';

type Intensity = 'subtle' | 'medium' | 'strong';

interface GlassViewProps {
  children: React.ReactNode;
  intensity?: Intensity;
  style?: ViewStyle;
  borderRadius?: number;
}

export function GlassView({
  children,
  intensity = 'medium',
  style,
  borderRadius = 16,
}: GlassViewProps) {
  const { isDark } = useTheme();

  const INTENSITY_CONFIG = isDark
    ? {
        subtle: { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)' },
        medium: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)' },
        strong: { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.14)' },
      }
    : {
        subtle: { bg: 'rgba(0,0,0,0.03)', border: 'rgba(0,0,0,0.06)' },
        medium: { bg: 'rgba(0,0,0,0.05)', border: 'rgba(0,0,0,0.10)' },
        strong: { bg: 'rgba(0,0,0,0.08)', border: 'rgba(0,0,0,0.14)' },
      };

  const cfg = INTENSITY_CONFIG[intensity];

  return (
    <View
      style={[
        {
          backgroundColor: cfg.bg,
          borderWidth: 1,
          borderColor: cfg.border,
          borderRadius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
