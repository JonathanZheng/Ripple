import { View, Text } from 'react-native';
import { Component } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { DesignSystemScene } from '@/components/three/DesignSystemScene';

class SceneErrorBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* 3D Background — wrapped in error boundary so a WebGL failure doesn't crash the screen */}
      <SceneErrorBoundary>
        <DesignSystemScene />
      </SceneErrorBoundary>

      {/* Overlay gradient */}
      <View
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%)',
        } as any}
        pointerEvents="none"
      />

      {/* Content */}
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {/* Glass card */}
        <View
          style={{
            width: '100%',
            backgroundColor: 'rgba(0,0,0,0.72)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.09)',
            borderRadius: 28,
            padding: 32,
            alignItems: 'center',
          }}
        >
          {/* Wordmark */}
          <Text
            style={{
              color: '#ffffff',
              fontSize: 42,
              fontWeight: '800',
              letterSpacing: -2,
              marginBottom: 8,
            }}
          >
            Ripple
          </Text>

          {/* Tagline */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: 15,
              textAlign: 'center',
              letterSpacing: -0.2,
              marginBottom: 6,
            }}
          >
            Small actions. Big community.
          </Text>

          {/* Separator */}
          <View
            style={{
              width: 32,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.12)',
              marginVertical: 20,
            }}
          />

          {/* Description */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.38)',
              fontSize: 13,
              textAlign: 'center',
              lineHeight: 20,
              letterSpacing: -0.1,
              marginBottom: 28,
              paddingHorizontal: 8,
            }}
          >
            Connect with your residential college. Post quests, accept challenges, and build trust.
          </Text>

          {/* CTA buttons */}
          <View style={{ width: '100%', gap: 10 }}>
            <Button
              variant="primary"
              size="lg"
              onPress={() => router.push('/(auth)/sign-up')}
              style={{ width: '100%' }}
            >
              Get Started
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onPress={() => router.push('/(auth)/sign-in')}
              style={{ width: '100%' }}
            >
              Sign In
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

 