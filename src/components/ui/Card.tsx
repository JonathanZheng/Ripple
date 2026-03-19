import React from 'react';
import { Pressable, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';

type CardVariant = 'default' | 'elevated';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  glow?: boolean;
  variant?: CardVariant;
  style?: ViewStyle;
  padding?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  children,
  onPress,
  glow = false,
  variant = 'default',
  style,
  padding = 16,
}: CardProps) {
  const scale = useSharedValue(1);
  const { colors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bg = variant === 'elevated' ? colors.surface2 : colors.surface;
  const border = variant === 'elevated' ? colors.borderStrong : colors.border;

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 20,
    padding,
    ...(glow && {
      shadowColor: '#7c3aed',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    }),
  };

  if (onPress) {
    return (
      <AnimatedPressable
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
        onPress={onPress}
        style={[animatedStyle, containerStyle, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      {children}
    </View>
  );
}
 