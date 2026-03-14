import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

function FloatingOrb({
  size,
  color,
  delay,
  x,
  y,
}: {
  size: number;
  color: string;
  delay: number;
  x: string;
  y: string;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.08, { duration: 2500 }),
          withTiming(0.03, { duration: 2500 })
        ),
        -1,
        true
      )
    );
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: 3000 }),
          withTiming(12, { duration: 3000 })
        ),
        -1,
        true
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
}

export function DesignSystemScene() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <FloatingOrb size={200} color="#7c3aed" delay={0}    x="-20%" y="5%" />
      <FloatingOrb size={150} color="#ffffff" delay={800}  x="70%"  y="15%" />
      <FloatingOrb size={100} color="#ec4899" delay={400}  x="40%"  y="60%" />
      <FloatingOrb size={180} color="#7c3aed" delay={1200} x="80%"  y="70%" />
      <FloatingOrb size={80}  color="#ffffff" delay={600}  x="10%"  y="50%" />
    </View>
  );
}
