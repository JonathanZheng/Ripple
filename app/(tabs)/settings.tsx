import { View, Text, ScrollView, Switch } from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { TRUST_TIER_CONFIG, QUEST_TAGS, TAG_COLOURS } from '@/constants';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { useTheme } from '@/lib/ThemeContext';
import { ChevronRight, Bell, Shield, Lock, HelpCircle, Info, Flag } from 'lucide-react-native';
import { Pressable } from 'react-native';
import type { NotificationPreferences } from '@/types/database';

const DEFAULT_PREFS: Required<NotificationPreferences> = {
  new_quest: true,
  quest_accepted: true,
  quest_complete: true,
  chat_message: true,
  route_offer_nearby: true,
  flash_quests: true,
  categories: [...QUEST_TAGS],
};

function RowDivider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.divider }} />;
}

function SettingsRow({ icon: Icon, label, onPress }: { icon: any; label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
      <Icon size={17} color={colors.textFaint} strokeWidth={1.8} />
      <Text style={{ flex: 1, color: colors.text, fontSize: 15, letterSpacing: -0.2 }}>
        {label}
      </Text>
      <ChevronRight size={15} color={colors.textFaint} strokeWidth={2} />
    </Pressable>
  );
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);
  const [signingOut, setSigningOut] = useState(false);
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<Required<NotificationPreferences>>(DEFAULT_PREFS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.notification_preferences) return;
      const p = profile.notification_preferences as NotificationPreferences;
      setPrefs({
        new_quest: p.new_quest ?? true,
        quest_accepted: p.quest_accepted ?? true,
        quest_complete: p.quest_complete ?? true,
        chat_message: p.chat_message ?? true,
        route_offer_nearby: p.route_offer_nearby ?? true,
        flash_quests: p.flash_quests ?? true,
        categories: p.categories ?? [...QUEST_TAGS],
      });
    }, [profile?.notification_preferences])
  );

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace('/(auth)');
  }

  function savePrefs(updated: Required<NotificationPreferences>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!session?.user?.id) return;
      await supabase
        .from('profiles')
        .update({ notification_preferences: updated })
        .eq('id', session.user.id);
    }, 600);
  }

  function togglePref(key: keyof Omit<NotificationPreferences, 'categories'>) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    savePrefs(updated);
  }

  function toggleCategory(cat: string) {
    const current = prefs.categories ?? [];
    const next = current.includes(cat)
      ? current.filter(c => c !== cat)
      : [...current, cat];
    const updated = { ...prefs, categories: next };
    setPrefs(updated);
    savePrefs(updated);
  }

  const tier = profile?.trust_tier ?? 'wanderer';
  const tierConfig = TRUST_TIER_CONFIG[tier];

  const NOTIF_TOGGLES: { key: keyof Omit<NotificationPreferences, 'categories'>; label: string }[] = [
    { key: 'new_quest', label: 'New Quests' },
    { key: 'quest_accepted', label: 'Quest Accepted' },
    { key: 'chat_message', label: 'Chat Messages' },
    { key: 'quest_complete', label: 'Quest Completed' },
    { key: 'route_offer_nearby', label: 'Nearby Route Offers' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, letterSpacing: -0.4, marginBottom: 3 }}>
                {profile?.display_name ?? '—'}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 13, marginBottom: 6 }} numberOfLines={1}>
                {session?.user.email ?? '—'}
              </Text>
              <Badge variant="tier" value={tier} color={tierConfig.colour} />
            </View>
          </Card>
        </View>

        {/* Notifications section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: colors.sectionLabel, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
            NOTIFICATIONS
          </Text>
          <Card padding={0}>
            {NOTIF_TOGGLES.map(({ key, label }, i) => (
              <View key={key}>
                {i > 0 && <RowDivider />}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
                  <Bell size={17} color={colors.textFaint} strokeWidth={1.8} />
                  <Text style={{ flex: 1, color: colors.text, fontSize: 15, letterSpacing: -0.2 }}>
                    {label}
                  </Text>
                  <Switch
                    value={prefs[key] as boolean}
                    onValueChange={() => togglePref(key)}
                    trackColor={{ false: 'rgba(255,255,255,0.10)', true: '#ffffff' }}
                    thumbColor="#7c3aed"
                  />
                </View>
              </View>
            ))}
            <RowDivider />
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 10 }}>
                QUEST CATEGORIES FOR NOTIFICATIONS
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {QUEST_TAGS.map(cat => (
                  <Chip
                    key={cat}
                    label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                    selected={(prefs.categories ?? []).includes(cat)}
                    color={TAG_COLOURS[cat]}
                    onPress={() => toggleCategory(cat)}
                  />
                ))}
              </View>
            </View>
          </Card>
        </View>

        {/* Account section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: colors.sectionLabel, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
            ACCOUNT
          </Text>
          <Card padding={0}>
            <SettingsRow icon={Flag} label="My Reports" onPress={() => router.push('/my-reports')} />
            <RowDivider />
            <SettingsRow icon={Shield} label="Privacy & Safety" />
            <RowDivider />
            <SettingsRow icon={Lock} label="Account Security" />
          </Card>
        </View>

        {/* About section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: colors.sectionLabel, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
            ABOUT
          </Text>
          <Card padding={0}>
            <SettingsRow icon={HelpCircle} label="Help & Support" />
            <RowDivider />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
              <Info size={17} color={colors.textFaint} strokeWidth={1.8} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 15, letterSpacing: -0.2 }}>
                Version
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 14 }}>1.0.0</Text>
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
