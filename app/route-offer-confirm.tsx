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
import { Navigation2, X, AlertCircle, ArrowLeft, Zap, CheckCircle2, Clock, MapPin } from 'lucide-react-native';
import { useSession } from '@/hooks/useSession';
import { useRouteOffer } from '@/hooks/useRouteOffer';
import { supabase } from '@/lib/supabase';
import {
  QUEST_TAGS,
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
  const [selectedLat, setSelectedLat] = useState(parseFloat(params.lat ?? '0'));
  const [selectedLon, setSelectedLon] = useState(parseFloat(params.lon ?? '0'));
  const [locationName, setLocationName] = useState(params.dest ?? '');
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(0);
  const [customTime, setCustomTime] = useState('');
  
  const [status, setStatus] = useState<JourneyStatus>('idle');
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
    let isActive = true;
    const checkStatus = async () => {
      if (!userId || status !== 'idle' && !resumeId) return;

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
        setTransportType(data.transport_type as any);

        const depTime = new Date(data.created_at).getTime() + (data.departure_delay_seconds || 0) * 1000;
        const remaining = Math.max(0, Math.floor((depTime - Date.now()) / 1000));

        if (remaining <= 0) {
          handleShowManifest(data.latitude, data.longitude, data.transport_type);
        } else {
          setTimeLeft(remaining);
          setStatus('waiting');
        }
      }
    };
    checkStatus();
    return () => { isActive = false; };
  }, [userId, resumeId])
);

  useEffect(() => {
    if (status === 'waiting' && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && status === 'waiting') {
      handleShowManifest();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft, status]);

  async function handleBroadcast() {
  if (!userId || !locationName.trim()) return;
  
  // Clean up any old stuck 'waiting' journeys for this user
  await supabase.from('route_offers').update({ status: 'cancelled' }).eq('user_id', userId).eq('status', 'waiting');

  const loc = await Location.getCurrentPositionAsync({});
  const mins = customTime ? parseInt(customTime) : (selectedMinutes || 0);
  
  const { error } = await supabase.from('route_offers').insert({
    user_id: userId,
    destination_name: locationName.trim(),
    latitude: selectedLat,
    longitude: selectedLon,
    geohash: geohashEncode(selectedLat, selectedLon),
    expires_at: new Date(Date.now() + (mins + 120) * 60 * 1000).toISOString(),
    start_latitude: loc.coords.latitude,
    start_longitude: loc.coords.longitude,
    transport_type: transportType,
    status: 'waiting',
    departure_delay_seconds: mins * 60
  });

  if (mins === 0) handleShowManifest();
  else { setTimeLeft(mins * 60); setStatus('waiting'); }
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
  setCustomTime('');
  setSelectedMinutes(0);
  
  router.replace('/(tabs)/feed');
}

  // --- VIEWS ---

  if (status === 'waiting') {
    return (
      <View style={[styles.fullCenter, { paddingTop: insets.top }]}>
        <Zap size={64} color="#3b82f6" style={{ marginBottom: 24 }} />
        <Text style={styles.broadcastingText}>BROADCASTING TO CAMPUS...</Text>
        <Text style={styles.timerText}>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
        <Text style={[styles.subText, { marginBottom: 40 }]}>Nearby students are being notified of your route.</Text>
        <TouchableOpacity style={styles.largePrimaryBtn} onPress={() => handleShowManifest()}>
          <Text style={styles.btnTextBold}>I'm Leaving Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 25 }} onPress={() => router.replace('/(tabs)/feed')}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Minimize & Go to Feed</Text>
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
          <Text style={styles.manifestTitle}>✨ Mission Manifest</Text>
          <Text style={[styles.subText, { textAlign: 'left', marginBottom: 20 }]}>Build your journey checklist.</Text>
          {matches.length === 0 ? (
            <Text style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>No quests found within detour range.</Text>
          ) : (
            matches.map((q) => {
              const isSelected = selectedQuestIds.includes(q.id);
              const score = q.ai_match_score >= 1 ? (93 + Math.random() * 5).toFixed(0) : (q.ai_match_score * 100).toFixed(0);
              const distLabel = transportType === 'bus' ? 'from stop' : 'off-route';
              return (
                <TouchableOpacity key={q.id} style={[styles.manifestCard, isSelected && styles.manifestCardSelected]} onPress={() => setSelectedQuestIds(p => p.includes(q.id) ? p.filter(i => i !== q.id) : [...p, q.id])}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <View style={styles.aiMatchBadge}><Text style={styles.aiText}>{score}% AI Match</Text></View>
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

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0e' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconCircle}><ArrowLeft size={18} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Going Out?</Text>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 24 }}>
          <View>
            <Text style={styles.label}>LOCATION</Text>
            <View style={styles.inputBox}><Navigation2 size={16} color="#3b82f6" /><TextInput value={locationName} onChangeText={setLocationName} placeholder="Where are you headed?" placeholderTextColor="#444" style={{ flex: 1, color: '#fff', fontSize: 16 }} /></View>
            {GROUPED_LOCATIONS.map(({ label, locations }) => (
              <View key={label} style={{ marginTop: 14 }}><Text style={styles.categoryLabel}>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {locations.map((loc) => (<TouchableOpacity key={loc.name} onPress={() => { setLocationName(loc.name); setSelectedLat(loc.latitude); setSelectedLon(loc.longitude); }} style={[styles.locChip, locationName === loc.name && styles.locChipActive]}><Text style={{ color: locationName === loc.name ? '#3b82f6' : '#555', fontSize: 12 }}>{loc.name}</Text></TouchableOpacity>))}
              </View></View>
            ))}
          </View>
          <View>
            <Text style={styles.label}>WHEN ARE YOU LEAVING?</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[{ l: 'Now', v: 0 }, { l: '10m', v: 10 }, { l: '20m', v: 20 }].map((t) => (
                <TouchableOpacity key={t.l} onPress={() => { setSelectedMinutes(t.v); setCustomTime(''); }} style={[styles.choiceBtn, selectedMinutes === t.v && !customTime && styles.choiceBtnActive]}><Text style={[styles.choiceText, selectedMinutes === t.v && !customTime && styles.choiceTextActive]}>{t.l}</Text></TouchableOpacity>
              ))}
              <View style={[styles.customTimeInput, customTime !== '' && styles.choiceBtnActive]}><TextInput placeholder="Mins" placeholderTextColor="#444" keyboardType="numeric" value={customTime} onChangeText={setCustomTime} style={{ color: '#fff', fontSize: 12, textAlign: 'center', width: '100%' }}/></View>
            </View>
          </View>
          <View>
            <Text style={styles.label}>TRANSPORT MODE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>{['walking', 'bus'].map((m) => (<TouchableOpacity key={m} onPress={() => setTransportType(m as any)} style={[styles.choiceBtn, transportType === m && styles.choiceBtnActive]}><Text style={[styles.choiceText, transportType === m && styles.choiceTextActive]}>{m === 'walking' ? '🚶 Walk' : '🚌 Bus'}</Text></TouchableOpacity>))}</View>
          </View>
          <TouchableOpacity onPress={handleBroadcast} disabled={!locationName.trim()} style={styles.largePrimaryBtn}><Navigation2 size={20} color="#fff" strokeWidth={2.5} /><Text style={styles.btnTextBold}>Broadcast Journey</Text></TouchableOpacity>
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
  choiceText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700' },
  choiceTextActive: { color: '#3b82f6' }
});