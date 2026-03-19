import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  style?: object;
}

export function ProgressBar({
  progress,
  color = '#ffffff',
  height = 3,
  style,
}: ProgressBarProps) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 600 });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View
      style={[
        {
          height,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 999,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            height,
            backgroundColor: color,
            borderRadius: 999,
          },
        ]}
      />
    </View>
  );
}
 