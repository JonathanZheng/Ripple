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
      <View className="px-5 pt-4 pb-6 border-b border-surface-3">
        <Text className="text-3xl font-bold text-white">Settings</Text>
        <Text className="text-muted text-sm mt-1">Manage your account</Text>
      </View>

      {/* Account section */}
      <View className="px-5 pt-6">
        <Text className="text-muted text-xs font-bold uppercase tracking-wider mb-3">
          Account
        </Text>

        <View className="bg-surface-2 rounded-xl border border-surface-3 overflow-hidden shadow-sm">
          {/* Email row */}
          <View className="px-4 py-4 border-b border-surface-3">
            <Text className="text-muted text-xs font-semibold mb-1">Email</Text>
            <Text className="text-white text-base font-semibold" numberOfLines={1}>
              {session?.user.email ?? '—'}
            </Text>
          </View>

          {/* Trust tier row */}
          <View className="px-4 py-4">
            <Text className="text-muted text-xs font-semibold mb-1">Trust Tier</Text>
            <View className="flex-row items-center gap-2">
              <View
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tierConfig.colour }}
              />
              <Text className="text-base font-bold" style={{ color: tierConfig.colour }}>
                {tierConfig.label}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* About section */}
      <View className="px-5 pt-6">
        <Text className="text-muted text-xs font-bold uppercase tracking-wider mb-3">
          About
        </Text>

        <View className="bg-surface-2 rounded-xl border border-surface-3 overflow-hidden shadow-sm">
          <View className="px-4 py-4">
            <Text className="text-muted text-xs font-semibold mb-1">Version</Text>
            <Text className="text-white text-base font-semibold">1.0.0</Text>
          </View>
        </View>
      </View>

      {/* Sign out section */}
      <View className="px-5 pt-6">
        <Text className="text-muted text-xs font-bold uppercase tracking-wider mb-3">
          Session
        </Text>

        <Pressable
          className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-4 flex-row items-center justify-between active:opacity-80"
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Text className="text-danger font-bold text-base">Sign Out</Text>
          {signingOut && <ActivityIndicator color="#ef4444" size="small" />}
        </Pressable>
      </View>
    </View>
  );
}
