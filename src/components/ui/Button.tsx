import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  icon?: LucideIcon;
  iconOnly?: boolean;
  style?: object;
}

const SIZE_STYLES: Record<Size, { px: number; py: number; fontSize: number; iconSize: number }> = {
  sm: { px: 14, py: 9, fontSize: 13, iconSize: 15 },
  md: { px: 20, py: 13, fontSize: 15, iconSize: 18 },
  lg: { px: 24, py: 16, fontSize: 16, iconSize: 20 },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  children,
  icon: Icon,
  iconOnly = false,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const { colors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const VARIANT_STYLES: Record<Variant, { bg: string; border: string; text: string }> = {
    primary: {
      bg: colors.primaryBg,
      border: 'transparent',
      text: colors.primaryText,
    },
    secondary: {
      bg: colors.secondaryBg,
      border: colors.secondaryBorder,
      text: colors.secondaryText,
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      text: colors.ghostText,
    },
    danger: {
      bg: 'rgba(239,68,68,0.10)',
      border: 'rgba(239,68,68,0.35)',
      text: '#ef4444',
    },
  };

  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      onPress={isDisabled ? undefined : onPress}
      style={[
        animatedStyle,
        {
          backgroundColor: v.bg,
          borderWidth: v.border === 'transparent' ? 0 : 1,
          borderColor: v.border,
          borderRadius: 16,
          paddingHorizontal: iconOnly ? s.py : s.px,
          paddingVertical: s.py,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Icon && !iconOnly ? 8 : 0,
          opacity: isDisabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {Icon && (
            <Icon size={s.iconSize} color={v.text} strokeWidth={2} />
          )}
          {!iconOnly && children && (
            <Text
              style={{
                color: v.text,
                fontSize: s.fontSize,
                fontWeight: '600',
                letterSpacing: -0.2,
              }}
            >
              {children}
            </Text>
          )}
        </>
      )}
    </AnimatedPressable>
  );
}
