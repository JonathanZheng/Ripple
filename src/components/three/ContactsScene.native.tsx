import React, { useEffect } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import type { ContactWithProfile } from '@/hooks/useContacts';

const { width: SCREEN_W } = Dimensions.get('window');
const ORBIT_RADIUS = Math.min(SCREEN_W * 0.32, 130);
const CENTER_SIZE = 60;
const NODE_SIZE = 42;

const tierColors: Record<string, string> = {
  champion: '#fbbf24',
  explorer: '#60a5fa',
  wanderer: '#a78bfa',
};

interface ContactNodeProps {
  contact: ContactWithProfile;
  index: number;
  total: number;
  radiusOffset?: number;
}

function ContactNode({ contact, index, total, radiusOffset = 0 }: ContactNodeProps) {
  const progress = useSharedValue(0);
  const baseAngle = (index / total) * Math.PI * 2;

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 8000 + radiusOffset * 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const radius = ORBIT_RADIUS + radiusOffset;

  const animStyle = useAnimatedStyle(() => {
    const angle = baseAngle + progress.value * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return {
      transform: [
        { translateX: x - NODE_SIZE / 2 },
        { translateY: y - NODE_SIZE / 2 },
      ],
    };
  });

  const nodeColor = tierColors[contact.trust_tier] ?? '#a78bfa';
  const initials = contact.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: NODE_SIZE,
          height: NODE_SIZE,
          alignItems: 'center',
        },
        animStyle,
      ]}
    >
      <Pressable
        onPress={() => router.push(`/contacts-graph` as any)}
        style={{
          width: NODE_SIZE,
          height: NODE_SIZE,
          borderRadius: NODE_SIZE / 2,
          backgroundColor: nodeColor + '22',
          borderWidth: 2,
          borderColor: nodeColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: nodeColor, fontSize: 13, fontWeight: '700' }}>{initials}</Text>
      </Pressable>
      <Text
        style={{ color: 'rgba(255,255,255,0.70)', fontSize: 10, fontWeight: '500', marginTop: 3 }}
        numberOfLines={1}
      >
        {contact.display_name.split(' ')[0]}
      </Text>
    </Animated.View>
  );
}

export function ContactsScene({ contacts }: { contacts: ContactWithProfile[] }) {
  const inner = contacts.slice(0, 6);
  const outer = contacts.slice(6, 12);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {/* Connection lines (decorative rings) */}
      <View
        style={{
          position: 'absolute',
          width: ORBIT_RADIUS * 2 + 20,
          height: ORBIT_RADIUS * 2 + 20,
          borderRadius: ORBIT_RADIUS + 10,
          borderWidth: 1,
          borderColor: 'rgba(124,58,237,0.15)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: (ORBIT_RADIUS + 50) * 2 + 20,
          height: (ORBIT_RADIUS + 50) * 2 + 20,
          borderRadius: (ORBIT_RADIUS + 50) + 10,
          borderWidth: 1,
          borderColor: 'rgba(124,58,237,0.10)',
        }}
      />

      {/* Nodes */}
      <View style={{ position: 'absolute', width: 0, height: 0 }}>
        {inner.map((c, i) => (
          <ContactNode key={c.contact_id} contact={c} index={i} total={inner.length} radiusOffset={0} />
        ))}
        {outer.map((c, i) => (
          <ContactNode key={c.contact_id} contact={c} index={i} total={outer.length} radiusOffset={50} />
        ))}
      </View>

      {/* Center hub */}
      <View
        style={{
          width: CENTER_SIZE,
          height: CENTER_SIZE,
          borderRadius: CENTER_SIZE / 2,
          backgroundColor: '#7c3aed',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#7c3aed',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 20,
          elevation: 10,
          zIndex: 2,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800' }}>R</Text>
      </View>
    </View>
  );
}
