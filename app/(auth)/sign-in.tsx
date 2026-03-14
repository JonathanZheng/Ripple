import { View, Text, Pressable, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Mail, Lock } from 'lucide-react-native';

export default function SignIn() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  const errorY = useSharedValue(-16);
  const errorOpacity = useSharedValue(0);
  const errorStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: errorY.value }],
    opacity: errorOpacity.value,
  }));

  function showError(msg: string) {
    setError(msg);
    errorY.value = -16;
    errorOpacity.value = 0;
    errorY.value = withSpring(0, { damping: 14, stiffness: 220 });
    errorOpacity.value = withSpring(1, { damping: 14, stiffness: 220 });
  }

  async function handleSignIn() {
    setError('');
    if (!identifier || !password) {
      showError('Please enter your email or display name, and your password.');
      return;
    }

    setLoading(true);
    try {
      let email = identifier.trim();

      if (!email.includes('@')) {
        const { data, error: rpcError } = await supabase.rpc('get_email_by_display_name', {
          p_display_name: email,
        });
        if (rpcError || !data) {
          showError('No account found with that display name.');
          return;
        }
        email = data as string;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        showError(signInError.message);
        return;
      }
      router.replace('/(tabs)/feed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 40,
          flexGrow: 1,
          justifyContent: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <Pressable
          onPress={() => router.back()}
          style={{ marginBottom: 32, alignSelf: 'flex-start', padding: 4, marginLeft: -4 }}
          hitSlop={12}
        >
          <ChevronLeft size={22} color="rgba(255,255,255,0.60)" strokeWidth={2} />
        </Pressable>

        {/* Header */}
        <View style={{ marginBottom: 36 }}>
          <Text style={{ color: '#ffffff', fontSize: 30, fontWeight: '700', letterSpacing: -1, marginBottom: 6 }}>
            Welcome back
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, letterSpacing: -0.2 }}>
            Sign in to your Ripple account
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <Animated.View
            style={[
              errorStyle,
              {
                backgroundColor: 'rgba(239,68,68,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.30)',
                borderRadius: 14,
                padding: 14,
                marginBottom: 20,
              },
            ]}
          >
            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '500' }}>{error}</Text>
          </Animated.View>
        ) : null}

        {/* Inputs */}
        <View style={{ gap: 14, marginBottom: 28 }}>
          <Input
            label="Email or display name"
            leftIcon={Mail}
            placeholder="you@u.nus.edu"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={identifier}
            onChangeText={setIdentifier}
            editable={!loading}
          />
          <Input
            label="Password"
            leftIcon={Lock}
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
        </View>

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleSignIn}
          style={{ width: '100%', marginBottom: 20 }}
        >
          Sign in
        </Button>

        {/* Link */}
        <Pressable onPress={() => router.push('/(auth)/sign-up')} disabled={loading} style={{ alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 14 }}>
            No account?{' '}
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Sign up</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
