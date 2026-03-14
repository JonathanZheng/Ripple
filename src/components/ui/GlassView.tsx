import React from 'react';
import { View, ViewStyle } from 'react-native';

type Intensity = 'subtle' | 'medium' | 'strong';

interface GlassViewProps {
  children: React.ReactNode;
  intensity?: Intensity;
  style?: ViewStyle;
  borderRadius?: number;
}

const INTENSITY_CONFIG: Record<Intensity, { bg: string; border: string }> = {
  subtle: {
    bg: 'rgba(255,255,255,0.03)',
    border: 'rgba(255,255,255,0.06)',
  },
  medium: {
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.10)',
  },
  strong: {
    bg: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.14)',
  },
};

export function GlassView({
  children,
  intensity = 'medium',
  style,
  borderRadius = 16,
}: GlassViewProps) {
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
