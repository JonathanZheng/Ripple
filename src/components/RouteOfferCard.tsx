import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Navigation2, MessageCircle, Star } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/lib/ThemeContext';
import { TRUST_TIER_CONFIG, TAG_COLOURS } from '@/constants';
import type { RouteOffer } from '@/types/database';

export interface RouteOfferWithProfile extends RouteOffer {
  profiles: {
    id: string;
    display_name: string;
    rc: string;
    trust_tier: string;
    avg_rating: number;
    avatar_url: string | null;
  };
}

interface Props {
  offer: RouteOfferWithProfile;
  currentUserId: string | undefined;
}

export function RouteOfferCard({ offer, currentUserId }: Props) {
  const { colors } = useTheme();
  const profile = offer.profiles;
  const tierConfig = TRUST_TIER_CONFIG[profile.trust_tier as keyof typeof TRUST_TIER_CONFIG];
  const expiresAt = new Date(offer.expires_at);
  const timeLeft = formatDistanceToNow(expiresAt, { addSuffix: false });

  // Don't render own card
  if (profile.id === currentUserId) return null;

  return (
    <Card
      style={{
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.20)',
      }}
    >
      {/* Profile row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar name={profile.display_name} size="sm" tierColor={tierConfig?.colour} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, letterSpacing: -0.2 }}>
            {profile.display_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{profile.rc}</Text>
            {profile.avg_rating > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Star size={10} color="#f59e0b" fill="#f59e0b" />
                <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600' }}>
                  {profile.avg_rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Badge variant="tier" value={profile.trust_tier as any} color={tierConfig?.colour} />
      </View>

      {/* Destination row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Navigation2 size={14} color="#3b82f6" strokeWidth={2.5} />
        <Text style={{ color: '#3b82f6', fontWeight: '700', fontSize: 14 }}>
          Heading to {offer.destination_name}
        </Text>
      </View>

      {/* Help tags */}
      {offer.tags.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {offer.tags.map((tag) => {
            const c = (TAG_COLOURS as Record<string, string>)[tag] ?? '#3b82f6';
            return (
              <View
                key={tag}
                style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                  backgroundColor: `${c}20`,
                  borderWidth: 1, borderColor: `${c}40`,
                }}
              >
                <Text style={{ color: c, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
                  {tag}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Note */}
      {offer.note ? (
        <Text
          style={{ color: colors.textMuted, fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}
          numberOfLines={2}
        >
          "{offer.note}"
        </Text>
      ) : null}

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textFaint, fontSize: 12 }}>
          Active for {timeLeft}
        </Text>
        <TouchableOpacity
          onPress={() => router.push(`/dm/${profile.id}`)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: '#3b82f6', borderRadius: 10,
            paddingHorizontal: 14, paddingVertical: 8,
          }}
          activeOpacity={0.8}
        >
          <MessageCircle size={14} color="#fff" strokeWidth={2.5} />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Chat</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}
 