import React from 'react';
import { Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  style?: object;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Chip({ label, selected, onPress, color, style }: ChipProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  let bg: string;
  let border: string;
  let textColor: string;

  if (selected) {
    if (color) {
      bg = color + '20';
      border = color + '55';
      textColor = color;
    } else {
      bg = 'rgba(255,255,255,0.90)';
      border = 'transparent';
      textColor = '#000000';
    }
  } else {
    bg = 'rgba(255,255,255,0.04)';
    border = 'rgba(255,255,255,0.10)';
    textColor = 'rgba(255,255,255,0.55)';
  }

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      onPress={onPress}
      style={[
        animatedStyle,
        {
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 7,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 13,
          fontWeight: '500',
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
