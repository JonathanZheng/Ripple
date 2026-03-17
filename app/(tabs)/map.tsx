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
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Check, Search, X, MapPin, SlidersHorizontal } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { TAG_COLOURS, QUEST_TAGS } from '@/constants';
import { Chip } from '@/components/ui/Chip';
import { QuestAccordion } from '@/components/map/QuestAccordion';
import { MobileBottomSheet } from '@/components/map/MobileBottomSheet';
import MapEngine from '@/components/map/MapEngine';
import type { Quest, Profile, QuestTag } from '@/types/database';

const CLUSTER_RADIUS = 0.001;
const PANEL_WIDTH = 440;

function getClusters(quests: Quest[]): Quest[][] {
  const clusters: Quest[][] = [];
  const processed = new Set<number>();

  quests.forEach((q, i) => {
    if (processed.has(i) || !q.latitude || !q.longitude) return;
    const cluster = [q];
    processed.add(i);

    quests.forEach((other, j) => {
      if (i === j || processed.has(j) || !other.latitude || !other.longitude) return;
      const dist = Math.sqrt(
        Math.pow(q.latitude! - other.latitude!, 2) +
          Math.pow(q.longitude! - other.longitude!, 2),
      );
      if (dist < CLUSTER_RADIUS) {
        cluster.push(other);
        processed.add(j);
      }
    });
    clusters.push(cluster);
  });

  return clusters;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isPickingMode = params.mode === 'pick';

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
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);

  // Poster cache
  const [posterProfiles, setPosterProfiles] = useState<Record<string, Profile>>({});
  const [loadingPosters, setLoadingPosters] = useState<Set<string>>(new Set());

  // Location picking
  const [pickedLocation, setPickedLocation] = useState<[number, number] | null>(null);

  // Web side-panel animation
  const panelTranslateX = useSharedValue(PANEL_WIDTH);
  const SLIDE = { duration: 220, easing: Easing.out(Easing.cubic) };
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panelTranslateX.value }],
  }));

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
    if (!q.latitude || !q.longitude) return false;
    const matchesSearch = !search || q.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag = tagFilter === 'all' || q.tag === tagFilter;
    return matchesSearch && matchesTag;
  });

  const clusters = getClusters(filteredQuests);

  function openPanel(clusterQuests: Quest[]) {
    if (isPickingMode) return;
    setSelectedQuests(clusterQuests);
    setExpandedQuestId(null);
    setIsPanelOpen(true);
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

  function handleMapPress(lat: number, lon: number) {
    if (isPickingMode) {
      setPickedLocation([lat, lon]);
    } else {
      closePanel();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#111' }}>
      {/* Map fills entire screen */}
      <View style={{ ...StyleSheet_absoluteFill }}>
        <MapEngine
          clusters={clusters}
          isPickingMode={isPickingMode}
          pickedLocation={pickedLocation}
          onClusterPress={openPanel}
          onMapPress={handleMapPress}
        />
      </View>

      {/* Floating search + filter (hidden in pick mode) */}
      {!isPickingMode && (
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

            {/* Filter toggle button */}
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
          </View>

          {/* Collapsible tag chips */}
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
      )}

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
              // @ts-ignore — web-only CSS properties
              backdropFilter: 'blur(28px) saturate(160%)', WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            },
            panelStyle,
          ]}
        >
          {/* Header */}
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
                {selectedQuests.length > 1 ? `${selectedQuests.length} Quests Here` : 'Quest Details'}
              </Text>
              {selectedQuests.length > 1 && (
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 3 }}>
                  Multiple tasks at this location
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={closePanel} hitSlop={8}>
              <X size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Quest list */}
          <FlatList
            data={selectedQuests}
            keyExtractor={(q) => q.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <QuestAccordion
                quest={item}
                userTier={userTier}
                isExpanded={expandedQuestId === item.id}
                onToggle={() => handleQuestToggle(item.id)}
                posterProfile={posterProfiles[item.poster_id] ?? null}
                isLoadingPoster={loadingPosters.has(item.poster_id)}
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
        />
      )}

      {/* Pick mode UI */}
      {isPickingMode && (
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: insets.bottom + 30,
            backgroundColor: 'rgba(12,12,12,0.96)',
            padding: 24,
            borderRadius: 24,
            alignItems: 'center',
            zIndex: 200,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <MapPin size={24} color={pickedLocation ? '#10b981' : 'rgba(255,255,255,0.4)'} style={{ marginBottom: 10 }} />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
            {pickedLocation ? 'Location selected' : 'Tap map to set location'}
          </Text>
          {pickedLocation && (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 }}>
              {pickedLocation[0].toFixed(5)}, {pickedLocation[1].toFixed(5)}
            </Text>
          )}
          {pickedLocation && (
            <TouchableOpacity
              style={{
                backgroundColor: '#10b981',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 14,
                borderRadius: 12,
                width: '100%',
                gap: 8,
                marginBottom: 10,
              }}
              onPress={() =>
                router.replace({
                  pathname: '/(tabs)/post-quest',
                  params: { lat: pickedLocation[0], lon: pickedLocation[1] },
                })
              }
            >
              <Check size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                Confirm Location
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Inline polyfill for StyleSheet.absoluteFill shape
const StyleSheet_absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
