import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/hooks/useSession';
import { useContacts } from '@/hooks/useContacts';
import { useTheme } from '@/lib/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { TRUST_TIER_CONFIG } from '@/constants';
// Expo auto-resolves ContactsScene.web.tsx on web, ContactsScene.native.tsx on native
import { ContactsScene } from '@/components/three/ContactsScene';

export default function ContactsGraph() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user?.id;
  const { contacts, loading } = useContacts(userId);
  const { colors } = useTheme();

  const sceneContacts = contacts.slice(0, 12);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={`Contacts (${contacts.length})`}
        backAction
        onBack={() => router.navigate('/(tabs)/profile' as any)}
      />

      {/* 3D / 2D Scene */}
      <View style={{ height: 300, position: 'relative' }}>
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color="rgba(255,255,255,0.30)" />
        ) : contacts.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 14 }}>
              No contacts yet. Complete quests to add contacts.
            </Text>
          </View>
        ) : (
          <ContactsScene contacts={sceneContacts} />
        )}
      </View>

      {/* All contacts list */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100, paddingTop: 16 }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 14 }}>
          ALL CONTACTS
        </Text>
        {listContacts(contacts, loading, colors)}
      </ScrollView>
    </View>
  );
}

function listContacts(contacts: ReturnType<typeof useContacts>['contacts'], loading: boolean, colors: any) {
  if (contacts.length === 0 && !loading) {
    return (
      <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
        Add contacts after completing quests together.
      </Text>
    );
  }
  return contacts.map((contact) => {
    const tierConfig = TRUST_TIER_CONFIG[contact.trust_tier as keyof typeof TRUST_TIER_CONFIG] ?? TRUST_TIER_CONFIG.wanderer;
    return (
      <View
        key={contact.contact_id}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Avatar name={contact.display_name} size="sm" tierColor={tierConfig.colour} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
            {contact.display_name}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: 12 }}>
            {contact.rc}
          </Text>
        </View>
        <Badge variant="tier" value={contact.trust_tier} color={tierConfig.colour} />
      </View>
    );
  });
}
 