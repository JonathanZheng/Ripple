import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, ShieldCheck, Info } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

/**
 * Verify screen — fallback profile creation.
 *
 * In the normal flow, sign-up.tsx creates the profile directly and routes
 * to the feed. This screen handles the edge case where a user has an auth
 * account but no profile row (e.g., interrupted sign-up, or a user who
 * signed up before the auth simplification).
 *
 * Student Pass photo upload has been removed — hackathon auth is gated by
 * NUS email domain (@u.nus.edu). Student Pass scanning is deferred to
 * post-launch.
 */
export default function Verify() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  async function handleContinue() {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Session expired. Please sign up again.');
        return;
      }

      const meta = user.user_metadata as {
        display_name?: string;
        rc?: string;
      };

      const displayName = meta.display_name || user.email?.split('@')[0] || 'User';
      const rc = meta.rc || 'Tembusu';

      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        display_name: displayName,
        rc,
      });

      // Ignore duplicate key error (profile already exists)
      if (insertError && insertError.code !== '23505') {
        setError(insertError.message);
        return;
      }

      router.replace('/(tabs)/feed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, justifyContent: 'center' }}>
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
        <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '700', letterSpacing: -0.8, marginBottom: 8 }}>
          Almost there
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 22 }}>
          Your NUS email has been verified. Tap below to finish setting up your profile and start using Ripple.
        </Text>
      </View>

      {/* Error */}
      {error ? (
        <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', borderRadius: 14, padding: 14, marginBottom: 20 }}>
          <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '500' }}>{error}</Text>
        </View>
      ) : null}

      {/* Verified badge */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={{ backgroundColor: 'rgba(16,185,129,0.10)', borderRadius: 20, padding: 20 }}>
          <ShieldCheck size={48} color="#10b981" strokeWidth={1.5} />
        </View>
        <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600', marginTop: 16 }}>
          NUS Student Verified
        </Text>
      </View>

      {/* Info callout */}
      <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 28, padding: 14 }}>
        <Info size={16} color="rgba(255,255,255,0.40)" strokeWidth={2} style={{ marginTop: 1 }} />
        <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, flex: 1, lineHeight: 19 }}>
          Your account is tied to your NUS email. This ensures every Ripple user is a verified student.
        </Text>
      </Card>

      {/* CTA */}
      <Button
        variant="primary"
        size="lg"
        loading={loading}
        onPress={handleContinue}
        style={{ width: '100%' }}
      >
        Get started
      </Button>
    </View>
  );
}
