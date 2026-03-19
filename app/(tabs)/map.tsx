import {
  View, Text, ActivityIndicator, Animated, Dimensions,
  TouchableOpacity, StyleSheet, FlatList, TextInput, Platform,
} from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/lib/ThemeContext';
import { TAG_COLOURS, QUEST_TAGS } from '@/constants';
import { QuestCard } from '@/components/QuestCard';
import { Chip } from '@/components/ui/Chip';
import { X, MapPin, Search, Check, Navigation, Compass, List } from 'lucide-react-native';
import type { Quest, QuestTag } from '@/types/database';
import * as Location from 'expo-location';
import { Map, Marker } from 'pigeon-maps';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

interface QuestWithDistance extends Quest {
  distance: number;
}

function getDist(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const isPickingMode = params.mode === 'pick';

  const { session } = useSession();
  const { profile } = useProfile(session?.user?.id);
  const userTier = profile?.trust_tier ?? 'wanderer';

  // Map & Location State
  const [mapCenter, setMapCenter] = useState<[number, number]>([1.3521, 103.8198]);
  const [mapZoom, setMapZoom] = useState(13);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Data State
  const [quests, setQuests] = useState<Quest[]>([]);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<QuestTag | 'all'>('all');

  // Panel State - Open by default on Web
  const [selectedQuests, setSelectedQuests] = useState<QuestWithDistance[]>([]);
  const [pickedLocation, setPickedLocation] = useState<[number, number] | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(!isMobile); 
  const panelAnim = useRef(new Animated.Value(isMobile ? SCREEN_HEIGHT * 0.5 : 0)).current;

  // 1. AUTO-PERMISSION & LOCATION ON MOUNT
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        const coords: [number, number] = [loc.coords.latitude, loc.coords.longitude];
        setUserLocation(coords);
        setMapCenter(coords); // Auto-focus on user
        setMapZoom(14);
      }
    })();
  }, []);

  const sortedQuests: QuestWithDistance[] = [...quests]
    .filter(q => {
      const matchesSearch = !search || q.title.toLowerCase().includes(search.toLowerCase());
      const matchesTag = tagFilter === 'all' || q.tag === tagFilter;
      return matchesSearch && matchesTag && q.latitude && q.longitude;
    })
    .map(q => ({
      ...q,
      distance: userLocation ? getDist(userLocation[0], userLocation[1], q.latitude!, q.longitude!) : 999
    }))
    .sort((a, b) => a.distance - b.distance);

  const fetchQuests = useCallback(async () => {
    const { data } = await supabase.from('quests').select('*').eq('status', 'open');
    if (data) setQuests(data as Quest[]);
  }, []);

  useFocusEffect(useCallback(() => { fetchQuests(); }, [fetchQuests]));

  const handleLocateMe = async () => {
    let loc = await Location.getCurrentPositionAsync({});
    const coords: [number, number] = [loc.coords.latitude, loc.coords.longitude];
    setUserLocation(coords);
    setMapCenter(coords);
    setMapZoom(15);
  };

  const openPanel = (questsToShow: QuestWithDistance[]) => {
    setSelectedQuests(questsToShow);
    setIsPanelOpen(true);
    Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
  };

  const closePanel = () => {
    // On mobile, "close" means slide back down to tray height. On web, it hides.
    Animated.spring(panelAnim, { 
        toValue: isMobile ? SCREEN_HEIGHT * 0.5 : 450, 
        useNativeDriver: true 
    }).start();
    if (!isMobile) setTimeout(() => { setSelectedQuests([]); setIsPanelOpen(false); }, 300);
  };

  const responsiveTransform = isMobile ? [{ translateY: panelAnim }] : [{ translateX: panelAnim }];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.mapWrapper}>
        <Map 
          center={mapCenter} zoom={mapZoom}
          onBoundsChanged={({ center, zoom }) => { setMapCenter(center); setMapZoom(zoom); }}
          onClick={() => isPickingMode ? null : closePanel()}
          boxClassname="map-dark-mode"
        >
          {userLocation && (
            <Marker anchor={userLocation} width={24}>
              <View style={styles.userDotContainer}><View style={styles.userDotHalo} /><View style={styles.userDot} /></View>
            </Marker>
          )}

          {!isPickingMode && sortedQuests.map((q) => (
            <Marker key={q.id} width={40} anchor={[q.latitude!, q.longitude!]}>
              <div style={{ cursor: 'pointer', pointerEvents: 'auto' }} onClick={(e) => { e.stopPropagation(); openPanel([q]); }}>
                <View style={[styles.markerBubble, { backgroundColor: TAG_COLOURS[q.tag] || '#7c3aed' }]}><MapPin size={18} color="#fff" /></View>
              </div>
            </Marker>
          ))}
        </Map>
      </View>

      {!isPickingMode && (
        <>
          <View style={[styles.floatingOverlay, { top: insets.top + 20 }]} pointerEvents="box-none">
            <View style={[styles.searchPill, { backgroundColor: 'rgba(30, 30, 30, 0.85)' }]} className="glass-effect">
              <Search size={20} color="rgba(255,255,255,0.5)" style={{ marginRight: 12 }} />
              <TextInput placeholder="Search quests..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} style={styles.minimalInput} />
            </View>
            <View style={styles.chipContainer} pointerEvents="box-none">
              <FlatList horizontal data={['all', ...QUEST_TAGS]} contentContainerStyle={styles.filterList} renderItem={({ item }) => (
                <Chip label={item} selected={tagFilter === item} color={(TAG_COLOURS as any)[item]} onPress={() => setTagFilter(item as any)} style={styles.opaqueChip} />
              )} />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.fab, { bottom: isMobile ? SCREEN_HEIGHT * 0.5 + 20 : insets.bottom + 100, right: 20, backgroundColor: '#3b82f6' }]} 
            onPress={handleLocateMe}
          >
            <Compass size={24} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      {/* RESPONSIVE PANEL */}
      <Animated.View
        style={[
          isMobile ? styles.bottomSheet : styles.sidePanel,
          {
            backgroundColor: 'rgba(15, 15, 15, 0.9)',
            transform: responsiveTransform,
            display: isPanelOpen || !isMobile ? 'flex' : 'none',
          }
        ]}
        className="glass-effect"
      >
        <View style={{ flex: 1 }}>
          {/* SLIDING HANDLE (Visual only for now) */}
          {isMobile && <View style={styles.dragHandle} />}
          
          <View style={styles.sidebarHeader}>
            <Text style={styles.panelTitle}>
              {selectedQuests.length === 1 ? 'Quest Details' : 'Nearest Quests'}
            </Text>
            {/* Close button only needed for single quest details or web */}
            {(selectedQuests.length === 1 || !isMobile) && (
              <TouchableOpacity onPress={closePanel}><X size={24} color="#fff" /></TouchableOpacity>
            )}
          </View>

          <FlatList
            data={selectedQuests.length > 0 ? selectedQuests : sortedQuests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={styles.listItem}>
                <QuestCard quest={item} userTier={userTier} />
                <View style={styles.itemMeta}>
                   <Text style={styles.distText}>{item.distance.toFixed(1)} km away</Text>
                   <TouchableOpacity onPress={() => router.push(`/quest/${item.id}`)} style={styles.miniBtn}>
                      <Text style={styles.miniBtnText}>View</Text>
                   </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      </Animated.View>

      {isPickingMode && (
        <View style={[styles.pickUI, { bottom: insets.bottom + 30 }]} className="glass-effect">
          <Text style={styles.pickTitle}>{pickedLocation ? "Location selected" : "Tap map to set location"}</Text>
          {pickedLocation && (
            <TouchableOpacity style={styles.confirmBtn} onPress={() => router.replace({ pathname: '/(tabs)/post-quest', params: { lat: pickedLocation[0], lon: pickedLocation[1] } })}>
              <Check size={20} color="#fff" /><Text style={styles.confirmBtnText}>Confirm Location</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}><Text style={{ color: 'rgba(255,255,255,0.4)' }}>Cancel</Text></TouchableOpacity>
        </View>
      )}

      <style>{`
        .map-dark-mode { filter: invert(90%) hue-rotate(180deg) brightness(95%); }
        .glass-effect { backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); }
        input:focus { outline: none !important; }
      `}</style>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrapper: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111' },
  floatingOverlay: { position: 'absolute', left: 20, zIndex: 100, alignItems: 'flex-start' },
  searchPill: { flexDirection: 'row', alignItems: 'center', width: 380, height: 52, borderRadius: 26, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  minimalInput: { flex: 1, color: '#fff', fontSize: 16 },
  chipContainer: { marginTop: 12, width: '100%' },
  filterList: { gap: 8 },
  opaqueChip: { backgroundColor: 'rgba(45, 45, 45, 0.98)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  userDotContainer: { alignItems: 'center', justifyContent: 'center' },
  userDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#3b82f6', borderWidth: 2, borderColor: '#fff' },
  userDotHalo: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(59, 130, 246, 0.2)' },
  fab: { position: 'absolute', width: 50, height: 50, borderRadius: 25, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, elevation: 5, zIndex: 100, borderWidth: 1, borderColor: '#fff' },
  markerBubble: { padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: 0.8 },
  
  // PANEL STYLES
  sidePanel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 450, zIndex: 2000, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT, borderTopLeftRadius: 30, borderTopRightRadius: 30, zIndex: 2000 },
  
  dragHandle: { width: 40, height: 5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, alignSelf: 'center', marginTop: 12 },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  panelTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  listItem: { paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  distText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  miniBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  miniBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  pickUI: { position: 'absolute', left: 20, right: 20, backgroundColor: 'rgba(15, 15, 15, 0.95)', padding: 24, borderRadius: 24, alignItems: 'center', zIndex: 150 },
  pickTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 15 },
  confirmBtn: { backgroundColor: '#10b981', flexDirection: 'row', padding: 16, borderRadius: 12, width: '100%', justifyContent: 'center', gap: 8 },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' }
});