import { View, Text, Pressable, ScrollView } from 'react-native';
import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { NUS_EMAIL_REGEX } from '@/constants';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

const RC_OPTIONS = ['Acacia', 'CAPT', 'NUSC', 'RC4', 'RVRC', 'Tembusu', 'UTR'];

export default function SignUp() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rc, setRc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const errorY = useSharedValue(-16);
  const errorOpacity = useSharedValue(0);
  const errorStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: errorY.value }],
    opacity: errorOpacity.value,
  }));

  const completeness = useMemo(() => {
    const fields = [displayName, email, password, confirmPassword, rc];
    return fields.filter(Boolean).length / fields.length;
  }, [displayName, email, password, confirmPassword, rc]);

  function showError(msg: string) {
    setError(msg);
    errorY.value = -16;
    errorOpacity.value = 0;
    errorY.value = withSpring(0, { damping: 14, stiffness: 220 });
    errorOpacity.value = withSpring(1, { damping: 14, stiffness: 220 });
  }

  async function handleSignUp() {
    setError('');
    if (!displayName || !email || !password || !rc) {
      showError('All fields are required.');
      return;
    }
    if (!NUS_EMAIL_REGEX.test(email.trim())) {
      showError('Please use your NUS email (e.g. e0123456@u.nus.edu).');
      return;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName, rc },
        },
      });

      if (signUpError) {
        showError(signUpError.message);
        return;
      }

      // Navigate to OTP verification screen
      router.push(`/(auth)/verify?email=${encodeURIComponent(email.trim())}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Progress bar */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <ProgressBar progress={completeness} color="#7c3aed" height={2} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 40,
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
        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: '#ffffff', fontSize: 30, fontWeight: '700', letterSpacing: -1, marginBottom: 6 }}>
            Create account
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, letterSpacing: -0.2 }}>
            Join Ripple with your NUS email
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
          <Input label="Display name" placeholder="e.g. Alex Tan" value={displayName} onChangeText={setDisplayName} editable={!loading} />
          <Input label="NUS email" placeholder="e0123456@u.nus.edu" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!loading} />
          <Input label="Password" placeholder="at least 6 characters" secureTextEntry value={password} onChangeText={setPassword} editable={!loading} />
          <Input label="Confirm password" placeholder="••••••••" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} editable={!loading} />
        </View>

        {/* RC Selection */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 13, fontWeight: '500', marginBottom: 12, letterSpacing: -0.1 }}>
            Residential College
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RC_OPTIONS.map(option => (
              <Chip
                key={option}
                label={option}
                selected={rc === option}
                onPress={() => setRc(option)}
              />
            ))}
          </View>
        </View>

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleSignUp}
          style={{ width: '100%', marginBottom: 20 }}
        >
          Create account
        </Button>

        {/* Link */}
        <Pressable onPress={() => router.back()} disabled={loading} style={{ alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 14 }}>
            Already have an account?{' '}
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
