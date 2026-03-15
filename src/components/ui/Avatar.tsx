import React from 'react';
import { Image, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  tierColor?: string;
  imageUrl?: string;
  style?: ViewStyle;
}

const SIZE_CONFIG: Record<AvatarSize, { dim: number; radius: number; fontSize: number }> = {
  sm: { dim: 30, radius: 10, fontSize: 11 },
  md: { dim: 42, radius: 13, fontSize: 15 },
  lg: { dim: 72, radius: 20, fontSize: 24 },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

export function Avatar({ name, size = 'md', tierColor, imageUrl, style }: AvatarProps) {
  const cfg = SIZE_CONFIG[size];
  const initials = getInitials(name || '?');
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          width: cfg.dim,
          height: cfg.dim,
          borderRadius: cfg.radius,
          backgroundColor: colors.surface2,
          borderWidth: tierColor ? 1.5 : 1,
          borderColor: tierColor ? tierColor + '60' : colors.border,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: cfg.dim, height: cfg.dim }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            color: tierColor ?? colors.textMuted,
            fontSize: cfg.fontSize,
            fontWeight: '700',
            letterSpacing: -0.5,
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
