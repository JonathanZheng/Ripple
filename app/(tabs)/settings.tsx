import { View, Text, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { TRUST_TIER_CONFIG } from '@/constants';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight, Bell, Shield, Lock, HelpCircle, Info } from 'lucide-react-native';

function RowDivider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />;
}

function SettingsRow({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
      <Icon size={17} color="rgba(255,255,255,0.45)" strokeWidth={1.8} />
      <Text style={{ flex: 1, color: 'rgba(255,255,255,0.80)', fontSize: 15, letterSpacing: -0.2 }}>
        {label}
      </Text>
      <ChevronRight size={15} color="rgba(255,255,255,0.20)" strokeWidth={2} />
    </View>
  );
}

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
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <ScreenHeader title="Settings" />

        {/* Identity card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Card variant="elevated" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar
              name={profile?.display_name ?? '?'}
              size="md"
              tierColor={tierConfig.colour}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16, letterSpacing: -0.4, marginBottom: 3 }}>
                {profile?.display_name ?? '—'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, marginBottom: 6 }} numberOfLines={1}>
                {session?.user.email ?? '—'}
              </Text>
              <Badge variant="tier" value={tier} color={tierConfig.colour} />
            </View>
          </Card>
        </View>

        {/* Account section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
            ACCOUNT
          </Text>
          <Card padding={0}>
            <SettingsRow icon={Bell} label="Notifications" />
            <RowDivider />
            <SettingsRow icon={Shield} label="Privacy & Safety" />
            <RowDivider />
            <SettingsRow icon={Lock} label="Account Security" />
          </Card>
        </View>

        {/* About section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
            ABOUT
          </Text>
          <Card padding={0}>
            <SettingsRow icon={HelpCircle} label="Help & Support" />
            <RowDivider />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
              <Info size={17} color="rgba(255,255,255,0.45)" strokeWidth={1.8} />
              <Text style={{ flex: 1, color: 'rgba(255,255,255,0.80)', fontSize: 15, letterSpacing: -0.2 }}>
                Version
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 14 }}>1.0.0</Text>
            </View>
          </Card>
        </View>

        {/* Sign out */}
        <View style={{ paddingHorizontal: 20 }}>
          <Button
            variant="danger"
            size="lg"
            loading={signingOut}
            onPress={handleSignOut}
            style={{ width: '100%' }}
          >
            Sign out
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
