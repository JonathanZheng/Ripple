import {
  View,
  Text,
  Platform,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Search, X, SlidersHorizontal, Navigation2, Compass } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { TAG_COLOURS, QUEST_TAGS, NUS_LOCATIONS } from '@/constants';
import { Chip } from '@/components/ui/Chip';
import { QuestAccordion } from '@/components/map/QuestAccordion';
import { MobileBottomSheet } from '@/components/map/MobileBottomSheet';
import MapEngine from '@/components/map/MapEngine';
import type { LocationMarker } from '@/components/map/MapEngine';
import type { Quest, Profile, QuestTag } from '@/types/database';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';

const PANEL_WIDTH = 440;

function getDist(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Assign each quest to its nearest NUS_LOCATION */
function buildLocationMarkers(quests: Quest[]): LocationMarker[] {
  const buckets: Record<string, Quest[]> = {};
  NUS_LOCATIONS.forEach((loc) => { buckets[loc.name] = []; });

  quests.forEach((q) => {
    if (q.latitude == null || q.longitude == null) return;
    let best = NUS_LOCATIONS[0].name;
    let bestDist = Infinity;
    for (const loc of NUS_LOCATIONS) {
      const d = Math.abs(q.latitude - loc.latitude) + Math.abs(q.longitude - loc.longitude);
      if (d < bestDist) { bestDist = d; best = loc.name; }
    }
    buckets[best].push(q);
  });

  return NUS_LOCATIONS.map((loc) => ({
    name: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    quests: buckets[loc.name],
  }));
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();

  const { session } = useSession();
  const userId = session?.user?.id;
  const { profile } = useProfile(userId);
  const userTier = profile?.trust_tier ?? 'wanderer';

  // Quest data
  const [quests, setQuests] = useState<Quest[]>([]);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<QuestTag | 'all'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Panel state
  const [selectedQuests, setSelectedQuests] = useState<Quest[]>([]);
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);

  // Poster cache
  const [posterProfiles, setPosterProfiles] = useState<Record<string, Profile>>({});
  const [loadingPosters, setLoadingPosters] = useState<Set<string>>(new Set());

  // Distance from user to the selected location marker (km)
  const [clusterDistance, setClusterDistance] = useState<number | undefined>(undefined);

  // Current location
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const mapRef = useRef<MapView>(null);

  // Web side-panel animation
  const panelTranslateX = useSharedValue(PANEL_WIDTH);
  const SLIDE = { duration: 220, easing: Easing.out(Easing.cubic) };
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panelTranslateX.value }],
  }));

  // Auto-request location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const coords: [number, number] = [loc.coords.latitude, loc.coords.longitude];
        setUserLocation(coords);
        mapRef.current?.animateToRegion(
          { latitude: coords[0], longitude: coords[1], latitudeDelta: 0.012, longitudeDelta: 0.012 },
          800,
        );
      }
    })();
  }, []);

  const handleLocateMe = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    const coords: [number, number] = [loc.coords.latitude, loc.coords.longitude];
    setUserLocation(coords);
    mapRef.current?.animateToRegion(
      { latitude: coords[0], longitude: coords[1], latitudeDelta: 0.010, longitudeDelta: 0.010 },
      500,
    );
  };

  const fetchQuests = useCallback(async () => {
    const { data, error } = await supabase.from('quests').select('*').eq('status', 'open');
    if (!error && data) setQuests(data as Quest[]);
  }, []);

  useFocusEffect(useCallback(() => {
    fetchQuests();
  }, [fetchQuests]));

  const now = new Date();
  const filteredQuests = quests.filter((q) => {
    if (new Date(q.deadline) <= now) return false;
    if (q.is_flash && q.flash_expires_at && new Date(q.flash_expires_at) <= now) return false;
    const matchesSearch = !search || q.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag = tagFilter === 'all' || q.tag === tagFilter;
    return matchesSearch && matchesTag;
  });

  const locationMarkers = useMemo(() => buildLocationMarkers(filteredQuests), [filteredQuests]);

  function openPanel(marker: LocationMarker) {
    setSelectedQuests(marker.quests);
    setSelectedLocationName(marker.name);
    setExpandedQuestId(null);
    setIsPanelOpen(true);
    if (userLocation) {
      setClusterDistance(getDist(userLocation[0], userLocation[1], marker.latitude, marker.longitude));
    } else {
      setClusterDistance(undefined);
    }
    if (Platform.OS === 'web') {
      panelTranslateX.value = withTiming(0, SLIDE);
    }
  }

  function closePanel() {
    if (Platform.OS === 'web') {
      panelTranslateX.value = withTiming(PANEL_WIDTH, SLIDE);
      setTimeout(() => {
        setSelectedQuests([]);
        setIsPanelOpen(false);
        setExpandedQuestId(null);
      }, 300);
    } else {
      setIsPanelOpen(false);
      setTimeout(() => {
        setSelectedQuests([]);
        setExpandedQuestId(null);
      }, 350);
    }
  }

  function handleQuestToggle(questId: string) {
    const newId = expandedQuestId === questId ? null : questId;
    setExpandedQuestId(newId);

    if (newId) {
      const quest = selectedQuests.find((q) => q.id === newId);
      if (quest && !posterProfiles[quest.poster_id] && !loadingPosters.has(quest.poster_id)) {
        setLoadingPosters((prev) => new Set(prev).add(quest.poster_id));
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, trust_tier, rc, avg_rating')
          .eq('id', quest.poster_id)
          .single()
          .then(({ data }) => {
            if (data) {
              setPosterProfiles((prev) => ({ ...prev, [quest.poster_id]: data as Profile }));
            }
            setLoadingPosters((prev) => {
              const next = new Set(prev);
              next.delete(quest.poster_id);
              return next;
            });
          });
      }
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#111' }}>
      {/* Map fills entire screen */}
      <View style={StyleSheet_absoluteFill}>
        <MapEngine
          mapRef={mapRef}
          locationMarkers={locationMarkers}
          onLocationPress={openPanel}
          userLocation={userLocation}
        />
      </View>

      {/* Floating search + filter */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 20,
          left: 16,
          right: Platform.OS === 'web' && isPanelOpen ? PANEL_WIDTH + 16 : 16,
          zIndex: 100,
        }}
      >
        {/* Search row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              height: 48,
              borderRadius: 24,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              backgroundColor: 'rgba(18,18,20,0.72)',
              gap: 8,
            }}
          >
            <Search size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              placeholder="Search quests…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, color: '#fff', fontSize: 15 }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <X size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setFiltersOpen((v) => !v)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: filtersOpen ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.14)',
              backgroundColor: filtersOpen ? 'rgba(124,58,237,0.25)' : 'rgba(18,18,20,0.72)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <SlidersHorizontal size={18} color={filtersOpen ? '#a78bfa' : 'rgba(255,255,255,0.55)'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLocateMe}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(59,130,246,0.5)',
              backgroundColor: 'rgba(29,78,216,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Compass size={18} color="#60a5fa" />
          </TouchableOpacity>
        </View>

        {filtersOpen && (
          <FlatList
            horizontal
            data={(['all', ...QUEST_TAGS] as (QuestTag | 'all')[])}
            keyExtractor={(item) => item}
            contentContainerStyle={{ gap: 8, paddingTop: 10 }}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Chip
                label={item}
                selected={tagFilter === item}
                color={(TAG_COLOURS as any)[item]}
                onPress={() => setTagFilter(item)}
                style={{
                  backgroundColor: 'rgba(18,18,20,0.82)',
                  borderColor: 'rgba(255,255,255,0.15)',
                  borderWidth: 1,
                }}
              />
            )}
          />
        )}
      </View>

      {/* Web: side panel */}
      {Platform.OS === 'web' && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: PANEL_WIDTH,
              backgroundColor: 'rgba(10,10,14,0.55)',
              borderLeftWidth: 1,
              borderLeftColor: 'rgba(255,255,255,0.10)',
              zIndex: 500,
              paddingTop: insets.top + 16,
              // @ts-ignore
              backdropFilter: 'blur(28px) saturate(160%)', WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            },
            panelStyle,
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <View>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>
                {selectedLocationName || 'Quest Details'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 3 }}>
                {selectedQuests.length === 0
                  ? 'No quests at this location'
                  : `${selectedQuests.length} quest${selectedQuests.length > 1 ? 's' : ''} here`}
              </Text>
            </View>
            <TouchableOpacity onPress={closePanel} hitSlop={8}>
              <X size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={selectedQuests}
            keyExtractor={(q) => q.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                  No open quests here yet
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <QuestAccordion
                quest={item}
                userTier={userTier}
                isExpanded={expandedQuestId === item.id}
                onToggle={() => handleQuestToggle(item.id)}
                posterProfile={posterProfiles[item.poster_id] ?? null}
                isLoadingPoster={loadingPosters.has(item.poster_id)}
                distance={clusterDistance}
              />
            )}
          />
        </Animated.View>
      )}

      {/* Mobile: bottom sheet */}
      {Platform.OS !== 'web' && (
        <MobileBottomSheet
          visible={isPanelOpen}
          quests={selectedQuests}
          expandedQuestId={expandedQuestId}
          onQuestToggle={handleQuestToggle}
          posterProfiles={posterProfiles}
          loadingPosters={loadingPosters}
          onClose={closePanel}
          userTier={userTier}
          clusterDistance={clusterDistance}
        />
      )}

      {/* "Going out?" FAB */}
      <TouchableOpacity
        onPress={() => router.push('/route-offer-confirm')}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 90,
          right: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: 'rgba(59,130,246,0.85)',
          zIndex: 300,
        }}
        activeOpacity={0.8}
      >
        <Navigation2 size={15} color="#fff" strokeWidth={2.5} />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Going out?</Text>
      </TouchableOpacity>
    </View>
  );
}

const StyleSheet_absoluteFill = {
  position: 'absolute' as const,
  top: 0, left: 0, right: 0, bottom: 0,
};
