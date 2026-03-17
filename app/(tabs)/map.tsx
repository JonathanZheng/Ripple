import {
  View,
  Text,
  ActivityIndicator,
  Animated,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Platform,
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
import { X, MapPin, Search, Check, Navigation, Layers } from 'lucide-react-native';
import type { Quest, QuestTag } from '@/types/database';

// FREE MAP ENGINE
import { Map, Marker } from 'pigeon-maps';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

// Distance threshold for clustering (approximate meters/coord units)
const CLUSTER_RADIUS = 0.001; 

export default function MapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const isPickingMode = params.mode === 'pick';

  const { session } = useSession();
  const userId = session?.user?.id;
  const { profile } = useProfile(userId);
  const userTier = profile?.trust_tier ?? 'wanderer';

  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<QuestTag | 'all'>('all');

  // Interaction State
  const [selectedQuests, setSelectedQuests] = useState<Quest[]>([]); // Now an array for clustering
  const [pickedLocation, setPickedLocation] = useState<[number, number] | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  const panelWidth = isMobile ? SCREEN_WIDTH : 450; // Made slightly wider for lists
  const sidePanelAnim = useRef(new Animated.Value(panelWidth)).current;

  const fetchQuests = useCallback(async () => {
    const { data, error } = await supabase.from('quests').select('*').eq('status', 'open');
    if (!error && data) setQuests(data as Quest[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchQuests(); }, [fetchQuests]));

  const openClusterDetail = (questsInCluster: Quest[]) => {
    if (isPickingMode) return;
    setSelectedQuests(questsInCluster);
    setIsPanelOpen(true);
    Animated.spring(sidePanelAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8
    }).start();
  };

  const closeSidePanel = () => {
    Animated.spring(sidePanelAnim, { toValue: panelWidth, useNativeDriver: true }).start();
    setTimeout(() => {
      setSelectedQuests([]);
      setIsPanelOpen(false);
    }, 300);
  };

  const filteredQuests = quests.filter(q => {
    const matchesSearch = !search || q.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag = tagFilter === 'all' || q.tag === tagFilter;
    return matchesSearch && matchesTag;
  });

  // --- CLUSTERING LOGIC ---
  const getClusters = () => {
    const clusters: Quest[][] = [];
    const processedIndices = new Set();

    filteredQuests.forEach((q, i) => {
      if (processedIndices.has(i)) return;
      if (!q.latitude || !q.longitude) return;

      const cluster = [q];
      processedIndices.add(i);

      filteredQuests.forEach((otherQ, j) => {
        if (i === j || processedIndices.has(j)) return;
        
        // Calculate distance (simple Euclidean for small distances)
        const dist = Math.sqrt(
          Math.pow((q.latitude || 0) - (otherQ.latitude || 0), 2) + 
          Math.pow((q.longitude || 0) - (otherQ.longitude || 0), 2)
        );

        if (dist < CLUSTER_RADIUS) {
          cluster.push(otherQ);
          processedIndices.add(j);
        }
      });
      clusters.push(cluster);
    });
    return clusters;
  };

  const clusters = getClusters();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.mapWrapper}>
        <Map 
          defaultCenter={[1.3521, 103.8198]} 
          defaultZoom={13}
          onClick={({ latLng }) => isPickingMode ? setPickedLocation(latLng) : closeSidePanel()}
          boxClassname="map-dark-mode"
        >
          {!isPickingMode && clusters.map((clusterQuests, idx) => {
            const firstQuest = clusterQuests[0];
            const count = clusterQuests.length;
            const isCluster = count > 1;

            return (
              <Marker
                key={firstQuest.id}
                width={isCluster ? 50 : 40}
                anchor={[firstQuest.latitude!, firstQuest.longitude!]}
              >
                <div 
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openClusterDetail(clusterQuests);
                  }}
                >
                  {isCluster ? (
                    <View style={styles.clusterMarker}>
                      <Text style={styles.clusterText}>{count}</Text>
                    </View>
                  ) : (
                    <View style={[styles.markerBubble, { backgroundColor: TAG_COLOURS[firstQuest.tag] || '#7c3aed' }]}>
                      <MapPin size={18} color="#fff" />
                    </View>
                  )}
                </div>
              </Marker>
            );
          })}

          {isPickingMode && pickedLocation && (
            <Marker anchor={pickedLocation} width={40}>
              <View style={styles.pickedMarker}><MapPin size={24} color="#fff" /></View>
            </Marker>
          )}
        </Map>
      </View>

      {/* FLOATING PILL SEARCH */}
      {!isPickingMode && (
        <View style={[styles.floatingOverlay, { top: insets.top + 20 }]} pointerEvents="box-none">
          <View style={[styles.searchPill, { backgroundColor: 'rgba(30, 30, 30, 0.85)' }]} className="glass-effect">
            <Search size={20} color="rgba(255,255,255,0.5)" style={{ marginRight: 12 }} />
            <TextInput placeholder="Search quests..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} style={styles.minimalInput} />
          </View>
          <View style={styles.chipContainer} pointerEvents="box-none">
            <FlatList
              horizontal
              data={['all', ...QUEST_TAGS]}
              contentContainerStyle={styles.filterList}
              renderItem={({ item }) => (
                <Chip label={item} selected={tagFilter === item} color={(TAG_COLOURS as any)[item]} onPress={() => setTagFilter(item as any)} style={styles.opaqueChip} />
              )}
            />
          </View>
        </View>
      )}

      {/* SIDEBAR / SIDE PANEL (HANDLES CLUSTERS) */}
      <Animated.View
        style={[
          styles.sidePanel,
          {
            backgroundColor: 'rgba(15, 15, 15, 0.9)',
            transform: [{ translateX: sidePanelAnim }],
            paddingTop: insets.top + 20,
            display: isPanelOpen ? 'flex' : 'none',
          }
        ]}
        className="glass-effect"
      >
        <View style={{ flex: 1 }}>
          <View style={styles.sidebarHeader}>
            <View>
              <Text style={styles.panelTitle}>
                {selectedQuests.length > 1 ? `${selectedQuests.length} Quests Here` : 'Quest Details'}
              </Text>
              {selectedQuests.length > 1 && <Text style={styles.sidebarSub}>Multiple tasks found at this location</Text>}
            </View>
            <TouchableOpacity onPress={closeSidePanel}><X size={28} color="#fff" /></TouchableOpacity>
          </View>

          <FlatList
            data={selectedQuests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 24, gap: 24 }}
            renderItem={({ item }) => (
              <View style={styles.clusterItem}>
                <QuestCard quest={item} userTier={userTier} />
                <TouchableOpacity
                  onPress={() => router.push(`/quest/${item.id}`)}
                  style={styles.viewQuestBtn}
                >
                  <Navigation size={18} color="#fff" />
                  <Text style={styles.viewQuestText}>Open Full Details</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </Animated.View>

      {/* PICKING UI */}
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
  searchPill: { flexDirection: 'row', alignItems: 'center', width: 380, height: 52, borderRadius: 26, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  minimalInput: { flex: 1, color: '#fff', fontSize: 16 },
  filterList: { gap: 8 },
  opaqueChip: { backgroundColor: 'rgba(45, 45, 45, 0.98)', borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1 },
  chipContainer: {
    marginTop: 12,
    width: '100%',
  },
  
  // MARKER STYLES
  markerBubble: { padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: 0.7},
  clusterMarker: { backgroundColor: '#7c3aed', width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#7c3aed', shadowRadius: 10, shadowOpacity: 0.5, opacity: 0.8 },
  clusterText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  pickedMarker: { backgroundColor: '#ef4444', padding: 10, borderRadius: 30, borderWidth: 3, borderColor: '#fff' },

  // SIDEBAR STYLES
  sidePanel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 450, zIndex: 2000, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 10 },
  panelTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  sidebarSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 },
  clusterItem: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 24 },
  viewQuestBtn: { backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, marginTop: 16 },
  viewQuestText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  pickUI: { position: 'absolute', left: 20, right: 20, backgroundColor: 'rgba(15, 15, 15, 0.95)', padding: 24, borderRadius: 24, alignItems: 'center', zIndex: 150 },
  pickTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 15 },
  confirmBtn: { backgroundColor: '#10b981', flexDirection: 'row', padding: 16, borderRadius: 12, width: '100%', justifyContent: 'center', gap: 8 },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' }
});