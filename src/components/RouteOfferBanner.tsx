import { View, Text, TouchableOpacity } from 'react-native';
import { Navigation2, X } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import type { RouteOffer } from '@/types/database';

interface Props {
  offer: RouteOffer;
  onCancel: () => void;
}

export function RouteOfferBanner({ offer, onCancel }: Props) {
  const expiresAt = new Date(offer.expires_at);
  const timeLeft = formatDistanceToNow(expiresAt, { addSuffix: false });

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(59,130,246,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.25)',
        padding: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(59,130,246,0.18)',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}
      >
        <Navigation2 size={16} color="#3b82f6" strokeWidth={2.5} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: '#3b82f6', fontWeight: '700', fontSize: 14, marginBottom: 2 }}>
          Heading to {offer.destination_name}
        </Text>
        <Text style={{ color: 'rgba(59,130,246,0.65)', fontSize: 12 }}>
          Active for {timeLeft}
        </Text>
        {offer.tags.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {offer.tags.map((tag) => (
              <View
                key={tag}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: 'rgba(59,130,246,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(59,130,246,0.25)',
                }}
              >
                <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity onPress={onCancel} hitSlop={10}>
        <X size={18} color="rgba(59,130,246,0.60)" strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}
 