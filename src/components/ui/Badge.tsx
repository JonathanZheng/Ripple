import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { TAG_COLOURS } from '@/constants';
import { useTheme } from '@/lib/ThemeContext';

type Variant = 'tag' | 'tier' | 'status' | 'mode' | 'default';

interface BadgeProps {
  variant?: Variant;
  value: string;
  color?: string;
  style?: ViewStyle;
}

const STATUS_COLOURS: Record<string, { bg: string; border: string; text: string }> = {
  open:        { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)',  text: '#10b981' },
  in_progress: { bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.30)',  text: '#60a5fa' },
  completed:   { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.60)' },
  expired:     { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)',   text: '#ef4444' },
  disputed:    { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)',  text: '#f59e0b' },
  cancelled:   { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.40)' },
};

const TIER_COLOURS: Record<string, string> = {
  wanderer: '#94a3b8',
  explorer: '#60a5fa',
  champion: '#fbbf24',
};

const MODE_LABELS: Record<string, string> = {
  meetup:   'Meet Up',
  dropoff:  'Drop Off',
  meet_up:  'Meet Up',
  drop_off: 'Drop Off',
};

export function Badge({ variant = 'default', value, color, style }: BadgeProps) {
  const { colors } = useTheme();

  let bg = colors.surface2;
  let border = colors.border;
  let text = colors.textMuted;
  let label = value;

  if (variant === 'tag') {
    const c = color ?? (TAG_COLOURS as Record<string, string>)[value] ?? '#ffffff';
    bg = c + '18';
    border = c + '35';
    text = c;
    label = value.charAt(0).toUpperCase() + value.slice(1);
  } else if (variant === 'status') {
    const s = STATUS_COLOURS[value.toLowerCase()] ?? STATUS_COLOURS.cancelled;
    bg = s.bg; border = s.border; text = s.text;
    label = value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } else if (variant === 'tier') {
    const c = color ?? TIER_COLOURS[value.toLowerCase()] ?? '#ffffff';
    bg = c + '18'; border = c + '35'; text = c;
    label = value.charAt(0).toUpperCase() + value.slice(1);
  } else if (variant === 'mode') {
    label = MODE_LABELS[value.toLowerCase()] ?? value;
  }

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: text,
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.1,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
 