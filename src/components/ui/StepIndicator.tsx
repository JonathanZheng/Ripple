import React from 'react';
import { View } from 'react-native';

interface StepIndicatorProps {
  steps: string[];
  currentIndex: number;
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {steps.map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 999,
            backgroundColor: i <= currentIndex
              ? '#ffffff'
              : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}
    </View>
  );
}
