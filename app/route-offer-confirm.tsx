import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navigation2, X, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useSession } from '@/hooks/useSession';
import { useRouteOffer } from '@/hooks/useRouteOffer';
import {
  QUEST_TAGS,
  ROUTE_OFFER_DURATIONS,
  NUS_LOCATIONS,
  NUS_LOCATION_CATEGORY_LABELS,
  type NusLocationCategory,
} from '@/constants';
import { Card } from '@/components/ui/Card';

function geohashEncode(lat: number, lng: number): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = '';
  let isLng = true;
  let bits = 0;
  let bitCount = 0;
  while (hash.length < 9) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { bits = (bits << 1) | 1; minLng = mid; }
      else { bits = bits << 1; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { bits = (bits << 1) | 1; minLat = mid; }
      else { bits = bits << 1; maxLat = mid; }
    }
    isLng = !isLng;
    bitCount++;
    if (bitCount === 5) { hash += BASE32[bits]; bits = 0; bitCount = 0; }
  }
  return hash;
}

// Group NUS_LOCATIONS by category, preserving display order
const CATEGORY_ORDER: NusLocationCategory[] = ['utown', 'rc', 'hall', 'school', 'canteen', 'library', 'mrt'];
const GROUPED_LOCATIONS = CATEGORY_ORDER.map((cat) => ({
  category: cat,
  label: NUS_LOCATION_CATEGORY_LABELS[cat],
  locations: NUS_LOCATIONS.filter((l) => l.category === cat),
})).filter((g) => g.locations.length > 0);

export default function RouteOfferConfirmScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lat?: string; lon?: string; dest?: string }>();
  const { session } = useSession();
  const userId = session?.user?.id;
  const { activeOffer, createOffer } = useRouteOffer(userId);

  const [selectedLat, setSelectedLat] = useState(parseFloat(params.lat ?? '0'));
  const [selectedLon, setSelectedLon] = useState(parseFloat(params.lon ?? '0'));

  const [locationName, setLocationName] = useState(params.dest ?? '');
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function handleBroadcast() {
    if (!userId || !locationName.trim()) return;
    setSubmitting(true);
    const hours = ROUTE_OFFER_DURATIONS[selectedDuration].hours;
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    await createOffer({
      destination_name: locationName.trim(),
      latitude: selectedLat,
      longitude: selectedLon,
      geohash: geohashEncode(selectedLat, selectedLon),
      tags: selectedTags,
      note: note.trim() || null,
      expires_at: expiresAt,
    });
    setSubmitting(false);
    router.replace('/(tabs)/feed');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0e' }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 20,
            paddingBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.07)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} color="rgba(255,255,255,0.70)" strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: 'rgba(59,130,246,0.15)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Navigation2 size={18} color="#3b82f6" strokeWidth={2} />
            </View>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>
              Going Out?
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 24 }}>
          {/* Existing offer warning */}
          {activeOffer && (
            <View
              style={{
                flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                backgroundColor: 'rgba(245,158,11,0.08)',
                borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
                borderRadius: 14, padding: 14,
              }}
            >
              <AlertCircle size={16} color="#f59e0b" strokeWidth={2} style={{ marginTop: 1 }} />
              <Text style={{ color: 'rgba(245,158,11,0.85)', fontSize: 13, flex: 1 }}>
                Replaces your current offer to{' '}
                <Text style={{ fontWeight: '700' }}>{activeOffer.destination_name}</Text>
              </Text>
            </View>
          )}

          {/* Location name */}
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
              LOCATION
            </Text>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 14, paddingHorizontal: 14, height: 48, gap: 10,
              }}
            >
              <Navigation2 size={16} color="#3b82f6" strokeWidth={2} />
              <TextInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder="Where are you headed?"
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={{ flex: 1, color: '#fff', fontSize: 15 }}
              />
              {locationName.length > 0 && (
                <TouchableOpacity onPress={() => setLocationName('')} hitSlop={8}>
                  <X size={14} color="rgba(255,255,255,0.30)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick-select grouped by category */}
            {GROUPED_LOCATIONS.map(({ category, label, locations }) => (
              <View key={category} style={{ marginTop: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.22)', fontSize: 9, fontWeight: '700', letterSpacing: 0.9, marginBottom: 8, textTransform: 'uppercase' }}>
                  {label}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {locations.map((loc) => {
                    const active = locationName === loc.name;
                    return (
                      <TouchableOpacity
                        key={loc.name}
                        onPress={() => {
                          setLocationName(loc.name);
                          setSelectedLat(loc.latitude);
                          setSelectedLon(loc.longitude);
                        }}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                          backgroundColor: active ? 'rgba(59,130,246,0.20)' : 'rgba(255,255,255,0.05)',
                          borderWidth: 1,
                          borderColor: active ? 'rgba(59,130,246,0.50)' : 'rgba(255,255,255,0.09)',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: active ? '#3b82f6' : 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' }}>
                          {loc.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {/* Duration */}
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
              HOW LONG?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {ROUTE_OFFER_DURATIONS.map((d, i) => (
                <TouchableOpacity
                  key={d.label}
                  onPress={() => setSelectedDuration(i)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
                    backgroundColor: selectedDuration === i ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: selectedDuration === i ? '#3b82f6' : 'rgba(255,255,255,0.09)',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: selectedDuration === i ? '#3b82f6' : 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '700' }}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tags */}
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 4 }}>
              WHAT CAN YOU HELP WITH?
            </Text>
            {selectedTags.length === 0 && (
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginBottom: 10 }}>
                Nothing selected — you can help with anything
              </Text>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: selectedTags.length === 0 ? 0 : 10 }}>
              {QUEST_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: selectedTags.includes(tag) ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: selectedTags.includes(tag) ? '#3b82f6' : 'rgba(255,255,255,0.09)',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: selectedTags.includes(tag) ? '#3b82f6' : 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Optional note */}
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
              OPTIONAL NOTE
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
              }}
            >
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Can grab bubble tea"
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={{ color: '#fff', fontSize: 14 }}
                multiline
              />
            </View>
          </View>

          {/* Broadcast button */}
          <TouchableOpacity
            onPress={handleBroadcast}
            disabled={!locationName.trim() || submitting}
            style={{
              backgroundColor: !locationName.trim() || submitting ? 'rgba(59,130,246,0.35)' : '#3b82f6',
              borderRadius: 16, paddingVertical: 16,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10,
            }}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Navigation2 size={18} color="#fff" strokeWidth={2.5} />
            }
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {submitting ? 'Broadcasting…' : 'Broadcast'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
