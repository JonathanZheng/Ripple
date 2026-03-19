import React, { useState } from 'react';
import { Pressable, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Eye, EyeOff, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPasswordField = textInputProps.secureTextEntry === true;
  const focusAnim = useSharedValue(0);
  const { colors } = useTheme();

  const borderNormal = error ? 'rgba(239,68,68,0.50)' : colors.inputBorder;
  const borderFocused = error ? 'rgba(239,68,68,0.70)' : colors.inputBorderFocus;

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [borderNormal, borderFocused]
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
            color: colors.labelColor,
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
            backgroundColor: colors.inputBg,
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
          <LeftIcon size={17} color={colors.inputIcon} strokeWidth={2} />
        )}
        <TextInput
          {...textInputProps}
          secureTextEntry={isPasswordField ? !passwordVisible : false}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={colors.inputPlaceholder}
          style={[
            {
              flex: 1,
              color: colors.inputText,
              fontSize: 15,
              padding: 0,
              margin: 0,
            },
            textInputProps.style,
          ]}
        />
        {isPasswordField ? (
          <Pressable onPress={() => setPasswordVisible(v => !v)} hitSlop={8}>
            {passwordVisible
              ? <EyeOff size={17} color={colors.inputIcon} strokeWidth={2} />
              : <Eye size={17} color={colors.inputIcon} strokeWidth={2} />
            }
          </Pressable>
        ) : RightIcon ? (
          <RightIcon size={17} color={colors.inputIcon} strokeWidth={2} />
        ) : null}
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
            color: colors.textFaint,
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
 