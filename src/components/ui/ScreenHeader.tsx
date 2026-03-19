import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  backAction?: boolean;
  onBack?: () => void;
}

export function ScreenHeader({ title, subtitle, rightAction, backAction, onBack }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1 }}>
        {backAction && (
          <Pressable
            onPress={() => onBack ? onBack() : router.back()}
            style={{ marginBottom: 8, alignSelf: 'flex-start', padding: 4, marginLeft: -4 }}
            hitSlop={12}
          >
            <ChevronLeft size={22} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        )}
        <Text
          style={{
            color: colors.text,
            fontSize: 24,
            fontWeight: '700',
            letterSpacing: -0.6,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 14,
              marginTop: 2,
              letterSpacing: -0.1,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightAction && (
        <View style={{ marginLeft: 12, marginBottom: 2 }}>
          {rightAction}
        </View>
      )}
    </View>
  );
}
 