import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { TRUST_TIER_CONFIG } from '@/constants';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace('/(auth)');
  }

  const tier = profile?.trust_tier ?? 'wanderer';
  const tierConfig = TRUST_TIER_CONFIG[tier];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-6 border-b border-surface-2">
        <Text className="text-2xl font-bold text-white">Settings</Text>
      </View>

      {/* Account section */}
      <View className="px-5 pt-6">
        <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
          Account
        </Text>

        <View className="bg-surface rounded-2xl border border-surface-2 overflow-hidden">
          {/* Email row */}
          <View className="px-4 py-4 border-b border-surface-2">
            <Text className="text-muted text-xs mb-0.5">Email</Text>
            <Text className="text-white text-sm" numberOfLines={1}>
              {session?.user.email ?? '—'}
            </Text>
          </View>

          {/* Trust tier row */}
          <View className="px-4 py-4">
            <Text className="text-muted text-xs mb-0.5">Trust Tier</Text>
            <Text className="text-sm font-semibold" style={{ color: tierConfig.colour }}>
              {tierConfig.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Sign out */}
      <View className="px-5 pt-6">
        <Text className="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
          Session
        </Text>

        <Pressable
          className="bg-surface rounded-2xl border border-surface-2 px-4 py-4 flex-row items-center justify-between"
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Text className="text-danger font-semibold">Sign Out</Text>
          {signingOut && <ActivityIndicator color="#ef4444" size="small" />}
        </Pressable>
      </View>
    </View>
  );
}
