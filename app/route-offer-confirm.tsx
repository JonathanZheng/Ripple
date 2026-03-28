import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navigation2, X, AlertCircle, ArrowLeft, Zap, CheckCircle2, Clock, MapPin, ChevronUp, ChevronDown, Radio } from 'lucide-react-native';
import { useSession } from '@/hooks/useSession';
import { useRouteOffer } from '@/hooks/useRouteOffer';
import { supabase } from '@/lib/supabase';
import {
  QUEST_TAGS,
  TAG_COLOURS,
  NUS_LOCATIONS,
  NUS_LOCATION_CATEGORY_LABELS,
  type NusLocationCategory,
} from '@/constants';
import * as Location from 'expo-location';

// --- HELPERS ---
function geohashEncode(lat: number, lng: number): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = '', isLng = true, bits = 0, bitCount = 0;
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
    isLng = !isLng; bitCount++;
    if (bitCount === 5) { hash += BASE32[bits]; bits = 0; bitCount = 0; }
  }
  return hash;
}

const formatDistance = (meters: number) => {
  if (meters < 15) return "on path";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

const CATEGORY_ORDER: NusLocationCategory[] = ['utown', 'rc', 'hall', 'school', 'canteen', 'library', 'mrt'];
const GROUPED_LOCATIONS = CATEGORY_ORDER.map((cat) => ({
  category: cat,
  label: NUS_LOCATION_CATEGORY_LABELS[cat],
  locations: NUS_LOCATIONS.filter((l) => l.category === cat),
})).filter((g) => g.locations.length > 0);

type JourneyStatus = 'idle' | 'waiting' | 'loading' | 'manifest';

export default function RouteOfferConfirmScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lat?: string; lon?: string; dest?: string }>();
  const { session } = useSession();
  const userId = session?.user?.id;

  // --- STATE ---
  const [broadcastType, setBroadcastType] = useState<'location' | 'journey'>('journey');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [locationDuration, setLocationDuration] = useState(60); // minutes, for location broadcast

  const [selectedLat, setSelectedLat] = useState(parseFloat(params.lat ?? '0'));
  const [selectedLon, setSelectedLon] = useState(parseFloat(params.lon ?? '0'));
  const [locationName, setLocationName] = useState(params.dest ?? '');
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(0);
  const [customHours, setCustomHours] = useState(0);
  const [customMins, setCustomMins] = useState(0);
  const [useCustomTime, setUseCustomTime] = useState(false);

  const [status, setStatus] = useState<JourneyStatus>('idle');
  const [initialChecking, setInitialChecking] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [transportType, setTransportType] = useState<'walking' | 'bus'>('walking');
  const [timeLeft, setTimeLeft] = useState(0);
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const timerRef = useRef<any>(null);

  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { resumeId, skipToManifest } = useLocalSearchParams<{ resumeId?: string; skipToManifest?: string }>();


  // Persistence logic
  useFocusEffect(
  useCallback(() => {
    setInitialChecking(true);   // always show spinner when screen is (re-)focused
    let isActive = true;
    const checkStatus = async () => {
      try {
        if (!userId || (status !== 'idle' && !resumeId)) return;

        const targetId = resumeId;
        const { data } = await supabase
          .from('route_offers')
          .select('*')
          .eq(targetId ? 'id' : 'status', targetId || 'waiting')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && isActive) {
          setLocationName(data.destination_name);
          setSelectedLat(data.latitude);
          setSelectedLon(data.longitude);
          if (data.transport_type === 'location') {
            setBroadcastType('location');
          } else {
            setBroadcastType('journey');
            setTransportType(data.transport_type as any);
          }

          const depTime = new Date(data.created_at).getTime() + (data.departure_delay_seconds || 0) * 1000;
          const remaining = Math.max(0, Math.floor((depTime - Date.now()) / 1000));

          if (remaining <= 0) {
            handleShowManifest(data.latitude, data.longitude, data.transport_type);
          } else {
            setTimeLeft(remaining);
            setStatus('waiting');
          }
        }
      } finally {
        if (isActive) setInitialChecking(false);
      }
    };
    checkStatus();
    return () => { isActive = false; };
  }, [userId, resumeId])
);

  useEffect(() => {
    if (status === 'waiting' && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && status === 'waiting' && broadcastType === 'journey') {
      handleShowManifest();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft, status, broadcastType]);

  async function handleBroadcast() {
    if (!userId || !locationName.trim()) return;
    setBroadcasting(true);
    try {
      // Cancel ALL existing active broadcasts for this user.
      // Filter by is_active=true because the unique constraint
      // "route_offers_one_active_per_user" is keyed on that flag.
      await supabase
        .from('route_offers')
        .update({ status: 'cancelled', is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Try to get GPS; fall back to selected location coords if unavailable
      let currentLat = selectedLat;
      let currentLon = selectedLon;
      try {
        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (permStatus === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          currentLat = loc.coords.latitude;
          currentLon = loc.coords.longitude;
        }
      } catch { /* continue with fallback coords */ }

      let insertError: any = null;

      if (broadcastType === 'location') {
        const lat = currentLat || selectedLat;
        const lon = currentLon || selectedLon;
        const { error } = await supabase.from('route_offers').insert({
          user_id: userId,
          destination_name: locationName.trim(),
          latitude: lat,
          longitude: lon,
          geohash: geohashEncode(lat, lon),
          expires_at: new Date(Date.now() + locationDuration * 60 * 1000).toISOString(),
          start_latitude: lat,
          start_longitude: lon,
          transport_type: 'location',
          status: 'waiting',
          is_active: true,
          departure_delay_seconds: 0,
          tags: selectedTags,
        });
        insertError = error;
        if (!error) {
          setTimeLeft(locationDuration * 60);
          setStatus('waiting');
        }
      } else {
        const mins = useCustomTime ? customHours * 60 + customMins : (selectedMinutes || 0);
        const { error } = await supabase.from('route_offers').insert({
          user_id: userId,
          destination_name: locationName.trim(),
          latitude: selectedLat,
          longitude: selectedLon,
          geohash: geohashEncode(selectedLat, selectedLon),
          expires_at: new Date(Date.now() + (mins + 120) * 60 * 1000).toISOString(),
          start_latitude: currentLat,
          start_longitude: currentLon,
          transport_type: transportType,
          status: 'waiting',
          is_active: true,
          departure_delay_seconds: mins * 60,
          tags: selectedTags,
        });
        insertError = error;
        if (!error) {
          if (mins === 0) handleShowManifest();
          else { setTimeLeft(mins * 60); setStatus('waiting'); }
        }
      }

      if (insertError) {
        console.error('route_offers insert error:', insertError);
        Alert.alert('Broadcast Failed', insertError.message ?? 'Unknown DB error. Check console.');
      }
    } catch (e: any) {
      console.error('handleBroadcast exception:', e);
      Alert.alert('Error', e?.message ?? 'Could not start broadcast. Please try again.');
    } finally {
      setBroadcasting(false);
    }
  }

  async function handleShowManifest(lat?: number, lon?: number, mode?: string) {
    setStatus('loading');
    const loc = await Location.getCurrentPositionAsync({});
    const { data } = await supabase.rpc('get_ai_ranked_route_quests', {
      user_origin_lon: loc.coords.longitude, user_origin_lat: loc.coords.latitude,
      user_dest_lon: lon || selectedLon, user_dest_lat: lat || selectedLat,
      user_pref_vector: null, transport_mode: mode || transportType
    });
    setMatches(data || []);
    setStatus('manifest');
  }

  async function handleAcceptBatch() {
  if (!userId) return;
  if (selectedQuestIds.length > 0) {
    await supabase.from('quests').update({ status: 'in_progress', acceptor_id: userId }).in('id', selectedQuestIds);
  }
  
  // Mark the journey as active so banner disappears
  await supabase.from('route_offers').update({ status: 'active' }).eq('user_id', userId).eq('status', 'waiting');

  // RESET EVERYTHING for the next use
  setStatus('idle');
  setMatches([]);
  setSelectedQuestIds([]);
  setLocationName('');
  setCustomHours(0);
  setCustomMins(0);
  setUseCustomTime(false);
  setSelectedMinutes(0);
  setSelectedTags([]);
  setBroadcastType('journey');
  
  router.replace('/(tabs)/feed');
}

  // --- VIEWS ---

  // Show spinner while doing the initial DB check — prevents any flash of the form
  if (initialChecking) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  if (status === 'waiting') {
    async function cancelBroadcast() {
      await supabase.from('route_offers').update({ status: 'cancelled', is_active: false }).eq('user_id', userId).eq('is_active', true);
      setStatus('idle');
      setTimeLeft(0);
      setLocationName('');
      setSelectedMinutes(0);
      setCustomHours(0);
      setCustomMins(0);
      setUseCustomTime(false);
      setSelectedTags([]);
      setBroadcastType('journey');
    }

    const isLocationBroadcast = broadcastType === 'location';
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const timerLabel = isLocationBroadcast
      ? `${mins}:${secs.toString().padStart(2, '0')} left`
      : `${mins}:${secs.toString().padStart(2, '0')}`;

    return (
      <View style={[styles.fullCenter, { paddingTop: insets.top }]}>
        {isLocationBroadcast ? (
          <Radio size={64} color="#10b981" style={{ marginBottom: 24 }} />
        ) : (
          <Zap size={64} color="#3b82f6" style={{ marginBottom: 24 }} />
        )}
        <Text style={[styles.broadcastingText, isLocationBroadcast && { color: '#10b981' }]}>
          {isLocationBroadcast ? 'YOU\'RE LIVE AT ' + locationName.toUpperCase() : 'BROADCASTING TO CAMPUS...'}
        </Text>
        <Text style={styles.timerText}>{timerLabel}</Text>
        <Text style={[styles.subText, { marginBottom: 40 }]}>
          {isLocationBroadcast
            ? 'Students can see you in the Broadcast tab and chat to request tasks.'
            : 'Nearby students are being notified of your route.'}
        </Text>
        {!isLocationBroadcast && (
          <TouchableOpacity style={styles.largePrimaryBtn} onPress={() => handleShowManifest()}>
            <Text style={styles.btnTextBold}>I'm Leaving Now</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={{ marginTop: isLocationBroadcast ? 0 : 25 }} onPress={() => router.replace('/(tabs)/feed')}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Minimize & Go to Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={cancelBroadcast}>
          <Text style={{ color: 'rgba(239,68,68,0.70)', fontWeight: '600' }}>Stop Broadcasting</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'loading') {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={[styles.subText, { marginTop: 20 }]}>AI is optimizing your Mission Manifest...</Text>
      </View>
    );
  }

  if (status === 'manifest') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0e', paddingTop: insets.top }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Back button */}
          <TouchableOpacity onPress={() => router.replace('/(tabs)/feed')} style={{ marginBottom: 16, alignSelf: 'flex-start' }}>
            <View style={styles.iconCircle}>
              <ArrowLeft size={18} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.manifestTitle}>✨ Mission Manifest</Text>
          <Text style={[styles.subText, { textAlign: 'left', marginBottom: 20 }]}>Build your journey checklist.</Text>
          {matches.length === 0 ? (
            <Text style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>No quests found within detour range.</Text>
          ) : (
            matches.map((q) => {
              const isSelected = selectedQuestIds.includes(q.id);
              const distLabel = transportType === 'bus' ? 'from stop' : 'off-route';
              return (
                <TouchableOpacity key={q.id} style={[styles.manifestCard, isSelected && styles.manifestCardSelected]} onPress={() => setSelectedQuestIds(p => p.includes(q.id) ? p.filter(i => i !== q.id) : [...p, q.id])}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <View style={[styles.aiMatchBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}><Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 11 }}>{formatDistance(q.distance_meters)} {distLabel}</Text></View>
                        </View>
                        <Text style={styles.cardLoc}>{q.location_name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>{q.description}</Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>{isSelected && <CheckCircle2 size={18} color="#fff" />}</View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
                    <Text style={styles.cardBounty}>+ ${q.reward_amount}</Text>
                    <Text style={styles.cardType}>{q.is_at_destination ? 'At Destination' : 'On Route'}</Text>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>
        <View style={{ padding: 20, gap: 10 }}>
            <TouchableOpacity style={[styles.largePrimaryBtn, { backgroundColor: selectedQuestIds.length > 0 ? '#10b981' : '#fff' }]} onPress={handleAcceptBatch}>
                <Text style={[styles.btnTextBold, { color: selectedQuestIds.length > 0 ? '#fff' : '#000' }]}>
                    {selectedQuestIds.length > 0 ? `Accept ${selectedQuestIds.length} Quests & Start` : 'No Missions, Just Start'}
                </Text>
            </TouchableOpacity>
            {selectedQuestIds.length > 0 && (
                <TouchableOpacity style={{ alignSelf: 'center', padding: 10 }} onPress={() => router.replace('/(tabs)/feed')}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Discard choices & Start Journey</Text>
                </TouchableOpacity>
            )}
        </View>
      </View>
    );
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const canBroadcast = locationName.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0e' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconCircle}><ArrowLeft size={18} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Going Out?</Text>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 24 }}>

          {/* ── Broadcast type selector ── */}
          <View>
            <Text style={styles.label}>BROADCAST TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setBroadcastType('location')}
                style={[styles.typeCard, broadcastType === 'location' && { borderColor: 'rgba(16,185,129,0.50)', backgroundColor: 'rgba(16,185,129,0.08)' }]}
              >
                <Radio size={22} color={broadcastType === 'location' ? '#10b981' : 'rgba(255,255,255,0.35)'} />
                <Text style={[styles.typeCardTitle, broadcastType === 'location' && { color: '#10b981' }]}>Location</Text>
                <Text style={styles.typeCardDesc}>I'm staying put — chat to request tasks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBroadcastType('journey')}
                style={[styles.typeCard, broadcastType === 'journey' && styles.typeCardActive]}
              >
                <Navigation2 size={22} color={broadcastType === 'journey' ? '#3b82f6' : 'rgba(255,255,255,0.35)'} />
                <Text style={[styles.typeCardTitle, broadcastType === 'journey' && { color: '#3b82f6' }]}>Journey</Text>
                <Text style={styles.typeCardDesc}>I'm heading somewhere — pick up tasks en route</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Location / destination picker ── */}
          <View>
            <Text style={styles.label}>{broadcastType === 'location' ? 'WHERE ARE YOU?' : 'DESTINATION'}</Text>
            <View style={styles.inputBox}>
              <Navigation2 size={16} color={broadcastType === 'location' ? '#10b981' : '#3b82f6'} />
              <TextInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder={broadcastType === 'location' ? 'e.g. RC4 Common Room' : 'Where are you headed?'}
                placeholderTextColor="#444"
                style={{ flex: 1, color: '#fff', fontSize: 16 }}
              />
            </View>
            {GROUPED_LOCATIONS.map(({ label, locations }) => (
              <View key={label} style={{ marginTop: 14 }}>
                <Text style={styles.categoryLabel}>{label}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {locations.map((loc) => (
                    <TouchableOpacity
                      key={loc.name}
                      onPress={() => { setLocationName(loc.name); setSelectedLat(loc.latitude); setSelectedLon(loc.longitude); }}
                      style={[styles.locChip, locationName === loc.name && styles.locChipActive]}
                    >
                      <Text style={{ color: locationName === loc.name ? (broadcastType === 'location' ? '#10b981' : '#3b82f6') : '#555', fontSize: 12 }}>{loc.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* ── Journey-only: departure time + transport ── */}
          {broadcastType === 'journey' && (
            <>
              <View>
                <Text style={styles.label}>WHEN ARE YOU LEAVING?</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {[{ l: 'Now', v: 0 }, { l: '15m', v: 15 }, { l: '30m', v: 30 }, { l: '1h', v: 60 }].map((t) => (
                    <TouchableOpacity key={t.l} onPress={() => { setSelectedMinutes(t.v); setUseCustomTime(false); }} style={[styles.choiceBtn, selectedMinutes === t.v && !useCustomTime && styles.choiceBtnActive]}>
                      <Text style={[styles.choiceText, selectedMinutes === t.v && !useCustomTime && styles.choiceTextActive]}>{t.l}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => { setUseCustomTime(true); setSelectedMinutes(null); }} style={[styles.choiceBtn, useCustomTime && styles.choiceBtnActive]}>
                    <Text style={[styles.choiceText, useCustomTime && styles.choiceTextActive]}>Custom</Text>
                  </TouchableOpacity>
                </View>
                {useCustomTime && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 14 }}>
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8 }}>HRS</Text>
                      <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, gap: 6 }}>
                        <TouchableOpacity onPress={() => setCustomHours(h => Math.min(23, h + 1))} hitSlop={8}><ChevronUp size={18} color="rgba(255,255,255,0.60)" /></TouchableOpacity>
                        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', minWidth: 32, textAlign: 'center' }}>{String(customHours).padStart(2, '0')}</Text>
                        <TouchableOpacity onPress={() => setCustomHours(h => Math.max(0, h - 1))} hitSlop={8}><ChevronDown size={18} color="rgba(255,255,255,0.60)" /></TouchableOpacity>
                      </View>
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 28, fontWeight: '700', marginTop: 16 }}>:</Text>
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8 }}>MINS</Text>
                      <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, gap: 6 }}>
                        <TouchableOpacity onPress={() => setCustomMins(m => Math.min(59, m + 5))} hitSlop={8}><ChevronUp size={18} color="rgba(255,255,255,0.60)" /></TouchableOpacity>
                        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', minWidth: 32, textAlign: 'center' }}>{String(customMins).padStart(2, '0')}</Text>
                        <TouchableOpacity onPress={() => setCustomMins(m => Math.max(0, m - 5))} hitSlop={8}><ChevronDown size={18} color="rgba(255,255,255,0.60)" /></TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
              <View>
                <Text style={styles.label}>TRANSPORT MODE</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['walking', 'bus'] as const).map((m) => (
                    <TouchableOpacity key={m} onPress={() => setTransportType(m)} style={[styles.choiceBtn, transportType === m && styles.choiceBtnActive]}>
                      <Text style={[styles.choiceText, transportType === m && styles.choiceTextActive]}>{m === 'walking' ? '🚶 Walk' : '🚌 Bus'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* ── Location-only: available duration ── */}
          {broadcastType === 'location' && (
            <View>
              <Text style={styles.label}>HOW LONG ARE YOU AVAILABLE?</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {[{ l: '30m', v: 30 }, { l: '1h', v: 60 }, { l: '2h', v: 120 }, { l: '3h', v: 180 }].map((t) => (
                  <TouchableOpacity
                    key={t.l}
                    onPress={() => setLocationDuration(t.v)}
                    style={[styles.choiceBtn, locationDuration === t.v && styles.choiceBtnGreen]}
                  >
                    <Text style={[styles.choiceText, locationDuration === t.v && { color: '#10b981' }]}>{t.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Tags: what can you help with ── */}
          <View>
            <Text style={styles.label}>WHAT CAN YOU HELP WITH?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {QUEST_TAGS.map((tag) => {
                const tagColour = (TAG_COLOURS as Record<string, string>)[tag] ?? '#3b82f6';
                const active = selectedTags.includes(tag);
                // Use white when multiple tags are selected (no single colour is "accurate");
                // use the tag's own colour when it's the only one selected.
                const activeColour = selectedTags.length > 1 ? '#ffffff' : tagColour;
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                      backgroundColor: active ? `${activeColour}18` : 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: active ? `${activeColour}60` : 'rgba(255,255,255,0.10)',
                    }}
                  >
                    <Text style={{ color: active ? activeColour : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8 }}>Leave empty to indicate you can help with anything</Text>
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity
            onPress={handleBroadcast}
            disabled={!canBroadcast || broadcasting}
            style={[styles.largePrimaryBtn, (!canBroadcast || broadcasting) && { opacity: 0.5 }, broadcastType === 'location' && { backgroundColor: '#10b981' }]}
          >
            {broadcasting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : broadcastType === 'location' ? (
              <Radio size={20} color="#fff" strokeWidth={2.5} />
            ) : (
              <Navigation2 size={20} color="#fff" strokeWidth={2.5} />
            )}
            <Text style={styles.btnTextBold}>
              {broadcasting ? 'Starting...' : broadcastType === 'location' ? 'Broadcast Location' : 'Broadcast Journey'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullCenter: { flex: 1, backgroundColor: '#0a0a0e', justifyContent: 'center', alignItems: 'center', padding: 30 },
  timerText: { color: '#fff', fontSize: 90, fontWeight: '900', marginVertical: 24 },
  broadcastingText: { color: '#3b82f6', fontWeight: '800', letterSpacing: 2, fontSize: 13 },
  subText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  largePrimaryBtn: { backgroundColor: '#3b82f6', borderRadius: 20, paddingVertical: 22, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12, width: '100%' },
  btnTextBold: { color: '#fff', fontWeight: '800', fontSize: 18 },
  manifestTitle: { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 10 },
  manifestCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 22, padding: 18, marginBottom: 14 },
  manifestCardSelected: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)' },
  aiMatchBadge: { backgroundColor: 'rgba(59,130,246,0.15)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  aiText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 11 },
  cardLoc: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardBounty: { color: '#10b981', fontSize: 20, fontWeight: '800' },
  cardType: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  label: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingHorizontal: 14, height: 50, gap: 10 },
  locChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 6, marginBottom: 6 },
  locChipActive: { backgroundColor: 'rgba(59,130,246,0.20)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)' },
  categoryLabel: { color: 'rgba(255,255,255,0.22)', fontSize: 9, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  choiceBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)' },
  customTimeInput: { flex: 0.8, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)' },
  choiceBtnActive: { backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: '#3b82f6' },
  choiceBtnGreen: { backgroundColor: 'rgba(16,185,129,0.18)', borderWidth: 1, borderColor: '#10b981' },
  choiceText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700' },
  choiceTextActive: { color: '#3b82f6' },
  typeCard: {
    flex: 1, borderRadius: 16, padding: 14, gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'flex-start',
  },
  typeCardActive: {
    borderColor: 'rgba(59,130,246,0.50)',
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  typeCardTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  typeCardDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 15 },
});