import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  backAction?: boolean;
}

export function ScreenHeader({ title, subtitle, rightAction, backAction }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
            onPress={() => router.back()}
            style={{ marginBottom: 8, alignSelf: 'flex-start', padding: 4, marginLeft: -4 }}
            hitSlop={12}
          >
            <ChevronLeft size={22} color="rgba(255,255,255,0.70)" strokeWidth={2} />
          </Pressable>
        )}
        <Text
          style={{
            color: '#ffffff',
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
              color: 'rgba(255,255,255,0.45)',
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
