import { View, Text, TextInput, Pressable } from 'react-native';
import { useState, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

const OTP_LENGTH = 8;

export default function Verify() {
  const { colors } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const insets = useSafeAreaInsets();
  const inputs = useRef<(TextInput | null)[]>([]);

  function handleChange(text: string, index: number) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');
    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const token = otp.join('');
    if (token.length < OTP_LENGTH) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    if (!email) {
      setError('Email missing. Please go back and sign up again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      const user = data.user;
      if (!user) {
        setError('Verification failed. Please try again.');
        return;
      }

      // Create profile using metadata stored during sign-up
      const meta = user.user_metadata as { display_name?: string; rc?: string };
      const displayName = meta.display_name || email.split('@')[0];
      const rc = meta.rc || 'Tembusu';

      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        display_name: displayName,
        rc,
      });

      // Ignore duplicate key — profile may already exist
      if (insertError && insertError.code !== '23505') {
        setError(insertError.message);
        return;
      }

      router.replace('/(tabs)/feed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    setError('');
    await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, justifyContent: 'center' }}>
      {/* Back */}
      <Pressable
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 16, left: 24, padding: 4 }}
        hitSlop={12}
      >
        <ChevronLeft size={22} color={colors.textMuted} strokeWidth={2} />
      </Pressable>

      {/* Icon */}
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <View style={{ backgroundColor: 'rgba(124,58,237,0.12)', borderRadius: 20, padding: 20 }}>
          <Mail size={40} color="#7c3aed" strokeWidth={1.5} />
        </View>
      </View>

      {/* Header */}
      <View style={{ marginBottom: 32, alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.8, marginBottom: 8 }}>
          Check your email
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
          We sent a 6-digit code to{'\n'}
          <Text style={{ color: colors.text, fontWeight: '600' }}>{email}</Text>
        </Text>
      </View>

      {/* OTP boxes */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={el => { inputs.current[i] = el; }}
            value={digit}
            onChangeText={text => handleChange(text, i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            style={{
              width: 38,
              height: 50,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: digit ? '#7c3aed' : colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
              fontSize: 22,
              fontWeight: '700',
              textAlign: 'center',
            }}
          />
        ))}
      </View>

      {/* Error */}
      {error ? (
        <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', borderRadius: 14, padding: 14, marginBottom: 20 }}>
          <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '500' }}>{error}</Text>
        </View>
      ) : null}

      {/* Verify button */}
      <Button
        variant="primary"
        size="lg"
        loading={loading}
        onPress={handleVerify}
        style={{ width: '100%', marginBottom: 16 }}
      >
        Verify email
      </Button>

      {/* Resend */}
      <Pressable onPress={handleResend} disabled={resending} style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          {resent ? '✓ Code resent!' : resending ? 'Resending...' : "Didn't receive it? "}
          {!resent && !resending && <Text style={{ color: colors.text, fontWeight: '600' }}>Resend code</Text>}
        </Text>
      </Pressable>
    </View>
  );
}
