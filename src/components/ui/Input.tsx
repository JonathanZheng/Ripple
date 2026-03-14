import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LucideIcon } from 'lucide-react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  containerStyle?: ViewStyle;
  rounded?: boolean;
}

export function Input({
  label,
  error,
  hint,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  containerStyle,
  rounded = false,
  ...textInputProps
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [
        error ? 'rgba(239,68,68,0.50)' : 'rgba(255,255,255,0.08)',
        error ? 'rgba(239,68,68,0.70)' : 'rgba(255,255,255,0.30)',
      ]
    ),
  }));

  const handleFocus = () => {
    setFocused(true);
    focusAnim.value = withTiming(1, { duration: 200 });
    textInputProps.onFocus?.({} as any);
  };

  const handleBlur = () => {
    setFocused(false);
    focusAnim.value = withTiming(0, { duration: 200 });
    textInputProps.onBlur?.({} as any);
  };

  const borderRadius = rounded ? 999 : 14;

  return (
    <View style={[{ marginBottom: 4 }, containerStyle]}>
      {label && (
        <Text
          style={{
            color: 'rgba(255,255,255,0.50)',
            fontSize: 13,
            fontWeight: '500',
            marginBottom: 7,
            letterSpacing: -0.1,
          }}
        >
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          {
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderWidth: 1,
            borderRadius,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: rounded ? 18 : 14,
            paddingVertical: 13,
            gap: 10,
          },
          animatedBorderStyle,
        ]}
      >
        {LeftIcon && (
          <LeftIcon size={17} color="rgba(255,255,255,0.35)" strokeWidth={2} />
        )}
        <TextInput
          {...textInputProps}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor="rgba(255,255,255,0.22)"
          style={[
            {
              flex: 1,
              color: '#ffffff',
              fontSize: 15,
              padding: 0,
              margin: 0,
            },
            textInputProps.style,
          ]}
        />
        {RightIcon && (
          <RightIcon size={17} color="rgba(255,255,255,0.35)" strokeWidth={2} />
        )}
      </Animated.View>
      {error && (
        <Text
          style={{
            color: '#ef4444',
            fontSize: 12,
            marginTop: 5,
            letterSpacing: -0.1,
          }}
        >
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12,
            marginTop: 5,
          }}
        >
          {hint}
        </Text>
      )}
    </View>
  );
}
