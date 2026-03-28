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
const CENTER_SIZE = 76;  // bigger hub
const NODE_SIZE = 42;

const tierColors: Record<string, string> = {
  champion: '#fbbf24',
  explorer: '#60a5fa',
  wanderer: '#a78bfa',
};

// Each plane defined by (inclination, ascending node Ω).
// The 2D screen projection of a circular orbit with these params:
//   x = r * (cosθ·cosΩ  −  sinθ·cosI·sinΩ)
//   y = r * (cosθ·sinΩ  +  sinθ·cosI·cosΩ)
//
// Choose inc/Ω so the projected ellipse major-axis varies wildly:
//   Plane 0  inc=0°,  Ω=0°   → perfect circle   (moves every direction equally)
//   Plane 1  inc=55°, Ω=0°   → flat horiz ellipse (left ↔ right dominant)
//   Plane 2  inc=55°, Ω=90°  → tall vert  ellipse (up ↕ down dominant)
//   Plane 3  inc=50°, Ω=45°  → diagonal ellipse  (↗ ↙)
//   Plane 4  inc=50°, Ω=135° → diagonal ellipse  (↖ ↘)
//   Plane 5  inc=65°, Ω=60°  → flat+rotated ellipse (distinct from 3 & 4)
const PLANES = [
  { inc: 0,                          Ω: 0 },
  { inc: (55 * Math.PI) / 180,      Ω: 0 },
  { inc: (55 * Math.PI) / 180,      Ω: Math.PI / 2 },
  { inc: (50 * Math.PI) / 180,      Ω: Math.PI / 4 },
  { inc: (50 * Math.PI) / 180,      Ω: (3 * Math.PI) / 4 },
  { inc: (65 * Math.PI) / 180,      Ω: Math.PI / 3 },
];

interface ContactNodeProps {
  contact: ContactWithProfile;
  index: number;
  total: number;
  orbitRadius: number;
  duration: number;
  planeIndex: number;
}

function ContactNode({ contact, index, total, orbitRadius, duration, planeIndex }: ContactNodeProps) {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(1);
  const baseAngle = (index / total) * Math.PI * 2;

  const plane = PLANES[planeIndex % PLANES.length];
  const inc = plane.inc;
  const omega = plane.Ω;

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1.12, { duration: 1800 + (planeIndex % 3) * 300, easing: Easing.inOut(Easing.sine) }),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const θ = baseAngle + progress.value * Math.PI * 2;

    const cosΩ = Math.cos(omega);
    const sinΩ = Math.sin(omega);
    const cosI = Math.cos(inc);
    const sinI = Math.sin(inc);
    const cosθ = Math.cos(θ);
    const sinθ = Math.sin(θ);

    // 3D orbit projected onto screen plane
    const x = orbitRadius * (cosθ * cosΩ - sinθ * cosI * sinΩ);
    const y = orbitRadius * (cosθ * sinΩ + sinθ * cosI * cosΩ);
    const z = orbitRadius * sinθ * sinI;   // depth (not drawn, used for cues)

    // More dramatic depth cues so 3D is obvious
    const depth = (z / orbitRadius + 1) / 2; // 0..1
    const depthScale = 0.55 + 0.55 * depth;  // 0.55 → 1.10  (big range)
    const depthOpacity = 0.35 + 0.65 * depth; // 0.35 → 1.00

    return {
      transform: [
        { translateX: x - NODE_SIZE / 2 },
        { translateY: y - NODE_SIZE / 2 },
        { scale: pulse.value * depthScale },
      ],
      opacity: depthOpacity,
    };
  });

  const nodeColor = tierColors[contact.trust_tier] ?? '#a78bfa';
  const initials = contact.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: NODE_SIZE, height: NODE_SIZE, alignItems: 'center' },
        animStyle,
      ]}
    >
      <Pressable
        onPress={() => router.push('/contacts-graph' as any)}
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

function RippleRings({ radius }: { radius: number }) {
  const s1 = useSharedValue(0);
  const s2 = useSharedValue(0);
  const s3 = useSharedValue(0);

  useEffect(() => {
    const DURATION = 2600;
    const run = (sv: typeof s1) =>
      sv.value = withRepeat(
        withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      );
    run(s1);
    const t2 = setTimeout(() => run(s2), DURATION / 3);
    const t3 = setTimeout(() => run(s3), (DURATION * 2) / 3);
    return () => { clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const makeStyle = (sv: typeof s1) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      transform: [{ scale: 0.25 + sv.value * 0.75 }],
      opacity: (1 - sv.value) * 0.5,
    }));

  const r1Style = makeStyle(s1);
  const r2Style = makeStyle(s2);
  const r3Style = makeStyle(s3);

  const ring = {
    position: 'absolute' as const,
    width: radius * 2,
    height: radius * 2,
    borderRadius: radius,
    borderWidth: 1.5,
    borderColor: '#7c3aed',
  };

  return (
    <>
      <Animated.View pointerEvents="none" style={[ring, r1Style]} />
      <Animated.View pointerEvents="none" style={[ring, r2Style]} />
      <Animated.View pointerEvents="none" style={[ring, r3Style]} />
    </>
  );
}

export function ContactsScene({ contacts }: { contacts: ContactWithProfile[] }) {
  const inner = contacts.slice(0, 6);
  const outer = contacts.slice(6, 12);

  // Decorative orbit-ring props matching the visual shape of each plane:
  // compressed height = full width * cos(inc), rotation = Ω in degrees
  const decorRings = [
    { scaleY: 1.00,  rot: 0   },  // Plane 0: circle
    { scaleY: 0.57,  rot: 0   },  // Plane 1: horiz ellipse
    { scaleY: 0.57,  rot: 90  },  // Plane 2: vert  ellipse
    { scaleY: 0.64,  rot: 45  },  // Plane 3: diagonal ↗
    { scaleY: 0.64,  rot: 135 },  // Plane 4: diagonal ↖
  ];

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {/* Ripple rings */}
      <RippleRings radius={ORBIT_RADIUS + 65} />

      {/* Decorative orbit ellipses — one per plane, brighter than before */}
      {decorRings.map(({ scaleY, rot }, idx) => (
        <View
          key={idx}
          style={{
            position: 'absolute',
            width: ORBIT_RADIUS * 2 + 12,
            height: (ORBIT_RADIUS * 2 + 12) * scaleY,
            borderRadius: ORBIT_RADIUS + 6,
            borderWidth: 2,
            borderColor: 'rgba(167,139,250,0.70)',
            transform: [{ rotate: `${rot}deg` }],
          }}
        />
      ))}

      {/* Nodes — 0×0 normal-flow View, centered by parent flex, so translateX/Y orbit offsets are correct */}
      <View style={{ width: 0, height: 0 }}>
        {inner.map((c, i) => (
          <ContactNode
            key={c.contact_id}
            contact={c}
            index={i}
            total={inner.length}
            orbitRadius={ORBIT_RADIUS}
            duration={7000 + i * 600}
            planeIndex={i}
          />
        ))}
        {outer.map((c, i) => (
          <ContactNode
            key={c.contact_id}
            contact={c}
            index={i}
            total={outer.length}
            orbitRadius={ORBIT_RADIUS + 55}
            duration={9500 + i * 500}
            planeIndex={(i + 3) % PLANES.length}
          />
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
          shadowOpacity: 0.9,
          shadowRadius: 24,
          elevation: 12,
          zIndex: 2,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800' }}>R</Text>
      </View>
    </View>
  );
}
