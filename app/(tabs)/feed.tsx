import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { useRouteOffer } from '@/hooks/useRouteOffer';
import { QuestCard } from '@/components/QuestCard';
import { RouteOfferBanner } from '@/components/RouteOfferBanner';
import { RouteOfferCard, type RouteOfferWithProfile } from '@/components/RouteOfferCard';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTheme } from '@/lib/ThemeContext';
import { QUEST_TAGS, TAG_COLOURS, ROUTE_OFFER_RADIUS_DEG } from '@/constants';
import { Search, Layers, SlidersHorizontal, Navigation2 } from 'lucide-react-native';
import {
  rankFeed,
  initialSessionBoosts,
  incrementSessionBoost,
  type AcceptedQuestSummary,
  type SessionTagBoosts,
  type RankingContext,
} from '@/lib/ranking';
import type { Quest, QuestTag, FulfilmentMode } from '@/types/database';
import { TrajectoryBanner } from '@/components/TrajectoryBanner';

const MODE_OPTIONS: { value: FulfilmentMode | 'all'; label: string }[] = [
  { value: 'all',     label: 'Any' },
  { value: 'meetup',  label: 'Meet Up' },
  { value: 'dropoff', label: 'Drop Off' },
];

type QuestTypeFilter = 'all' | 'standard' | 'social' | 'crew';
const QUEST_TYPE_OPTIONS: { value: QuestTypeFilter; label: string }[] = [
  { value: 'all',      label: 'All Types' },
  { value: 'standard', label: 'Standard' },
  { value: 'social',   label: 'Social' },
  { value: 'crew',     label: 'Crew' },
];

type RewardFilter = 'all' | 'free' | '1-5' | '5-10' | '10+';
const REWARD_OPTIONS: { value: RewardFilter; label: string }[] = [
  { value: 'all',  label: 'Any' },
  { value: 'free', label: 'Free' },
  { value: '1-5',  label: '$1–5' },
  { value: '5-10', label: '$5–10' },
  { value: '10+',  label: '$10+' },
];

type DeadlineFilter = 'all' | 'hour' | 'today' | 'week';
const DEADLINE_OPTIONS: { value: DeadlineFilter; label: string }[] = [
  { value: 'all',   label: 'Any Time' },
  { value: 'hour',  label: 'Next Hour' },
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
];

function rewardInRange(amount: number, filter: RewardFilter): boolean {
  switch (filter) {
    case 'free': return amount === 0;
    case '1-5':  return amount > 0 && amount <= 5;
    case '5-10': return amount > 5 && amount <= 10;
    case '10+':  return amount > 10;
    default:     return true;
  }
}

function deadlineInRange(deadline: string, filter: DeadlineFilter): boolean {
  const now = new Date();
  const d = new Date(deadline);
  switch (filter) {
    case 'hour': return d.getTime() - now.getTime() <= 3600 * 1000;
    case 'today': {
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      return d <= end;
    }
    case 'week': {
      const end = new Date(now); end.setDate(end.getDate() + 7);
      return d <= end;
    }
    default: return true;
  }
}

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };

function getDist(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Feed() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);
  const { colors } = useTheme();

  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tagFilter, setTagFilter] = useState<QuestTag | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<FulfilmentMode | 'all'>('all');
  const [questTypeFilter, setQuestTypeFilter] = useState<QuestTypeFilter>('all');
  const [rewardFilter, setRewardFilter] = useState<RewardFilter>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword');
  const [semanticResults, setSemanticResults] = useState<Quest[] | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const { activeOffer, cancelOffer } = useRouteOffer(session?.user?.id);

  // Feed mode toggle + animated pill
  const [feedMode, setFeedMode] = useState<'quests' | 'broadcast'>('quests');
  const [routeOffers, setRouteOffers] = useState<RouteOfferWithProfile[]>([]);
  const [loadingBroadcast, setLoadingBroadcast] = useState(false);
  // Broadcast filters
  const [broadcastTagFilter, setBroadcastTagFilter] = useState<QuestTag | 'all'>('all');
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [broadcastFilterOpen, setBroadcastFilterOpen] = useState(false);
  const [broadcastDropdownContentHeight, setBroadcastDropdownContentHeight] = useState(150);
  const broadcastDropdownHeight = useSharedValue(0);
  const broadcastDropdownStyle = useAnimatedStyle(() => ({
    height: broadcastDropdownHeight.value,
    overflow: 'hidden',
  }));
  const toggleBroadcastFilter = () => {
    const next = !broadcastFilterOpen;
    setBroadcastFilterOpen(next);
    broadcastDropdownHeight.value = withTiming(next ? broadcastDropdownContentHeight : 0, { duration: 250 });
  };
  const feedPill = useSharedValue(0);
  const [feedTabWidth, setFeedTabWidth] = useState(0);
  const FEED_SLIDE = { duration: 220, easing: Easing.out(Easing.cubic) };
  const feedPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: feedPill.value * (feedTabWidth / 2) }],
  }));
  function switchFeedMode(mode: 'quests' | 'broadcast') {
    feedPill.value = withTiming(mode === 'quests' ? 0 : 1, FEED_SLIDE);
    setFeedMode(mode);
  }

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [acceptHistory, setAcceptHistory] = useState<AcceptedQuestSummary[]>([]);
  const [sessionBoosts, setSessionBoosts] = useState<SessionTagBoosts>(initialSessionBoosts());
  const [seenCounts, setSeenCounts] = useState<Map<string, number>>(new Map());
  const [contactIds, setContactIds] = useState<Set<string>>(new Set());

  const [dropdownContentHeight, setDropdownContentHeight] = useState(350);
  const dropdownHeight = useSharedValue(0);
  const dropdownStyle = useAnimatedStyle(() => ({
    height: dropdownHeight.value,
    overflow: 'hidden',
  }));

   useEffect(() => {
    channelRef.current = supabase
      .channel('quests-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quests' }, (payload) => {
        const newQuest = payload.new as Quest;
        if (newQuest.status === 'open') {
          setQuests((prev) => {
            // Only add if it doesn't already exist in state
            const exists = prev.some(q => q.id === newQuest.id);
            if (exists) return prev;
            return [newQuest, ...prev];
          });
        }
      })
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  const toggleFilter = () => {
    const next = !filterOpen;
    setFilterOpen(next);
    dropdownHeight.value = withTiming(next ? dropdownContentHeight : 0, { duration: 250 });
  };

  const resetFilters = () => {
    setTagFilter('all');
    setModeFilter('all');
    setQuestTypeFilter('all');
    setRewardFilter('all');
    setDeadlineFilter('all');
    setSessionBoosts(initialSessionBoosts());
  };

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  async function fetchQuests() {
    const { data, error } = await supabase
      .from('quests')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (!error && data) setQuests(data as Quest[]);
  }

  async function fetchHistory(userId: string): Promise<AcceptedQuestSummary[]> {
    const { data } = await supabase
      .from('quests')
      .select('tag, created_at, location_name, fulfilment_mode, reward_amount')
      .eq('acceptor_id', userId)
      .in('status', ['completed', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as AcceptedQuestSummary[];
  }

  async function fetchContactIds(userId: string) {
    const { data } = await supabase.from('contacts').select('contact_id').eq('user_id', userId);
    if (data) setContactIds(new Set(data.map((c: any) => c.contact_id)));
  }

  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id;
      Promise.all([
        fetchQuests(),
        userId ? fetchHistory(userId).then(setAcceptHistory) : Promise.resolve(),
        userId ? fetchContactIds(userId) : Promise.resolve(),
      ]).finally(() => setLoading(false));
    }, [session?.user.id]),
  );

  async function runSemanticSearch(query: string) {
    if (!query.trim()) { setSemanticResults(null); return; }
    setSemanticLoading(true);
    try {
      const { data: embedData, error: embedErr } = await supabase.functions.invoke('embed-query', {
        body: { query },
      });
      if (embedErr || !embedData?.embedding) { setSemanticLoading(false); return; }
      const { data: matches } = await supabase.rpc('search_quests', {
        query_embedding: embedData.embedding,
        match_threshold: 0.5,
        match_count: 20,
      });
      if (matches) {
        const ids = (matches as { id: string }[]).map(m => m.id);
        const { data: questData } = await supabase.from('quests').select('*').in('id', ids).eq('status', 'open');
        if (questData) {
          const ordered = ids
            .map(id => (questData as Quest[]).find(q => q.id === id))
            .filter((q): q is Quest => !!q);
          setSemanticResults(ordered);
        }
      }
    } catch { /* ignore */ }
    setSemanticLoading(false);
  }

  useEffect(() => {
    channelRef.current = supabase
      .channel('quests-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quests' }, (payload) => {
        const newQuest = payload.new as Quest;
        if (newQuest.status === 'open') setQuests((prev) => [newQuest, ...prev]);
      })
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation([loc.coords.latitude, loc.coords.longitude]);
      }
    })();
  }, []);

  useEffect(() => {
    if (feedMode !== 'broadcast') return;
    loadBroadcast();
  }, [feedMode]);

  async function loadBroadcast() {
    setLoadingBroadcast(true);
    const { data } = await supabase
      .from('route_offers')
      .select('*, profiles(id, display_name, rc, trust_tier, avg_rating, avatar_url)')
      .eq('status', 'waiting')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (data) setRouteOffers(data as RouteOfferWithProfile[]);
    setLoadingBroadcast(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    if (feedMode === 'broadcast') {
      await loadBroadcast();
    } else {
      await fetchQuests();
    }
    setRefreshing(false);
  }

  const userTier = profile?.trust_tier ?? 'wanderer';
  const userId = session?.user?.id;
  const now = new Date();
  const filtered = quests.filter((q) => {
    if (new Date(q.deadline) <= now) return false;
    if (q.is_flash && q.flash_expires_at && new Date(q.flash_expires_at) <= now) return false;
    if (tagFilter !== 'all' && q.tag !== tagFilter) return false;
    if (modeFilter !== 'all' && q.fulfilment_mode !== modeFilter) return false;
    if (questTypeFilter !== 'all' && (q as any).quest_type !== questTypeFilter) return false;
    if (rewardFilter !== 'all' && !rewardInRange(q.reward_amount ?? 0, rewardFilter)) return false;
    if (deadlineFilter !== 'all' && !deadlineInRange(q.deadline, deadlineFilter)) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      const haystack = `${q.title} ${q.description} ${q.ai_generated_title ?? ''}`.toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    return true;
  });

  const activeFilterCount = [
    tagFilter !== 'all',
    modeFilter !== 'all',
    questTypeFilter !== 'all',
    rewardFilter !== 'all',
    deadlineFilter !== 'all',
  ].filter(Boolean).length;

  const hasExtraFilters = questTypeFilter !== 'all' || rewardFilter !== 'all' || deadlineFilter !== 'all';

  // Skip damper: quests seen 3+ times without a tap
  const skippedQuestIds = useMemo(() => {
    const s = new Set<string>();
    seenCounts.forEach((count, id) => { if (count >= 3) s.add(id); });
    return s;
  }, [seenCounts]);

  // Build ranking context
  const rankingContext = useMemo<RankingContext | null>(() => {
    if (!profile) return null;
    return {
      userRc: profile.rc,
      tier: profile.trust_tier,
      skills: profile.skills ?? [],
      history: acceptHistory,
      sessionBoosts,
      skippedQuestIds,
    };
  }, [profile, acceptHistory, sessionBoosts, skippedQuestIds]);

  // Apply ranking after filters
  const { pinned, ranked } = useMemo(() => {
    if (!rankingContext) {
      return {
        pinned: [],
        ranked: filtered.map(q => ({ quest: q, score: 0, breakdown: {} as any })),
      };
    }
    return rankFeed(filtered, rankingContext);
  }, [filtered, rankingContext]);

  // Apply contacts boost: quests posted by contacts float up
  const rankedWithContactBoost = [...ranked].sort((a, b) => {
    const aBoost = contactIds.has(a.quest.poster_id) ? 1 : 0;
    const bBoost = contactIds.has(b.quest.poster_id) ? 1 : 0;
    if (bBoost !== aBoost) return bBoost - aBoost;
    return b.score - a.score;
  });

  // Semantic mode overrides the ranked list when results available
  const activeQuestList = useMemo(() => {
    let list: Quest[] = [];
    if (searchMode === 'semantic' && semanticResults !== null) {
      list = semanticResults;
    } else {
      // Combine pinned and ranked
      list = [...pinned, ...rankedWithContactBoost.map(r => r.quest)];
    }

    // FINAL SAFETY DEDUPLICATION
    return list.filter((item, index, self) => 
      index === self.findIndex((t) => t.id === item.id)
    );
  }, [searchMode, semanticResults, pinned, rankedWithContactBoost]);

  const feedData = activeQuestList;

  const onYourWayIds = useMemo((): Set<string> => {
    if (!activeOffer) return new Set();
    return new Set(
      filtered.filter(q =>
        q.latitude != null && q.longitude != null &&
        Math.abs(q.latitude  - activeOffer.latitude)  <= ROUTE_OFFER_RADIUS_DEG &&
        Math.abs(q.longitude - activeOffer.longitude) <= ROUTE_OFFER_RADIUS_DEG
      ).map(q => q.id)
    );
  }, [filtered, activeOffer]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    setSeenCounts(prev => {
      const next = new Map(prev);
      for (const { item } of viewableItems) {
        next.set(item.id, (next.get(item.id) ?? 0) + 1);
      }
      return next;
    });
  }, []);

  // Shared header rendered above both FlatLists (banners are NOT here — they live outside)
  const sharedHeader = (
    <View>
      <ScreenHeader
        title="Quests"
        subtitle={
          feedMode === 'broadcast'
            ? 'People heading out near UTown'
            : acceptHistory.length > 0
            ? 'Ranked for you'
            : 'Discover requests near you'
        }
      />

      {/* Quests / Scouts toggle — animated sliding pill */}
      <View
        onLayout={(e: LayoutChangeEvent) => setFeedTabWidth(e.nativeEvent.layout.width)}
        style={{
          flexDirection: 'row',
          marginHorizontal: 4,
          marginBottom: 14,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 14,
          padding: 4,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.07)',
          position: 'relative',
        }}
      >
        {/* Sliding white pill */}
        {feedTabWidth > 0 && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 4,
                bottom: 4,
                left: 4,
                width: (feedTabWidth - 8) / 2,
                backgroundColor: '#ffffff',
                borderRadius: 10,
              },
              feedPillStyle,
            ]}
          />
        )}
        {([
          { mode: 'quests' as const, label: 'Quests' },
          { mode: 'broadcast' as const, label: 'Broadcast' },
        ] as const).map(({ mode, label }) => (
          <Pressable
            key={mode}
            onPress={() => switchFeedMode(mode)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, zIndex: 1 }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: feedMode === mode ? '#000000' : 'rgba(255,255,255,0.40)',
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Broadcast filters */}
      {feedMode === 'broadcast' && (
        <View style={{ paddingHorizontal: 4, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                leftIcon={Search}
                placeholder="Search by destination…"
                value={broadcastSearch}
                onChangeText={setBroadcastSearch}
                returnKeyType="search"
                rounded
              />
            </View>
            <Pressable
              onPress={toggleBroadcastFilter}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: broadcastFilterOpen ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: broadcastFilterOpen ? 'rgba(124,58,237,0.40)' : 'rgba(255,255,255,0.10)',
              }}
            >
              <SlidersHorizontal size={18} color={broadcastFilterOpen ? '#a78bfa' : 'rgba(255,255,255,0.70)'} strokeWidth={2} />
              {broadcastTagFilter !== 'all' && (
                <View style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: '#7c3aed',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>1</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Animated.View style={[broadcastDropdownStyle, { paddingHorizontal: 0, marginBottom: broadcastFilterOpen ? 10 : 0 }]}>
            <View
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0) setBroadcastDropdownContentHeight(h);
              }}
              style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 16,
              gap: 14,
            }}>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 }}>
                  CAN HELP WITH
                </Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={(['all', ...QUEST_TAGS] as (QuestTag | 'all')[])}
                  keyExtractor={(item) => item}
                  contentContainerStyle={{ gap: 6 }}
                  renderItem={({ item }) => (
                    <Chip
                      label={item === 'all' ? 'Any' : item.charAt(0).toUpperCase() + item.slice(1)}
                      selected={broadcastTagFilter === item}
                      color={item !== 'all' ? TAG_COLOURS[item] : undefined}
                      onPress={() => setBroadcastTagFilter(item as typeof broadcastTagFilter)}
                    />
                  )}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );

   return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Persistent banners — rendered outside FlatLists so they never unmount on tab switch ── */}
      <View style={{ paddingTop: insets.top }}>
        {userId && <TrajectoryBanner userId={userId} />}
        {activeOffer && <RouteOfferBanner offer={activeOffer} onCancel={cancelOffer} />}
      </View>

      {feedMode === 'quests' ? (
        <FlatList
          key="quests-list"
          data={feedData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <QuestCard
              quest={item}
              userTier={userTier}
              from="feed"
              isOnYourWay={onYourWayIds.has(item.id)}
              distance={
                userLocation && item.latitude != null && item.longitude != null
                  ? getDist(userLocation[0], userLocation[1], item.latitude, item.longitude)
                  : undefined
              }
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textFaint} />
          }
          ListHeaderComponent={
            <View>
              {sharedHeader}

            {/* Search + filter button row */}
            <View style={{ paddingHorizontal: 4, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input
                  leftIcon={Search}
                  placeholder={searchMode === 'semantic' ? 'Semantic search...' : 'Search quests...'}
                  value={search}
                  onChangeText={(t) => {
                    setSearch(t);
                    if (searchMode === 'semantic') setSemanticResults(null);
                  }}
                  returnKeyType="search"
                  onSubmitEditing={() => { if (searchMode === 'semantic') runSemanticSearch(search); }}
                  rounded
                />
              </View>
              {/* AI / Semantic toggle pill */}
              <Pressable
                onPress={() => {
                  const next = searchMode === 'keyword' ? 'semantic' : 'keyword';
                  setSearchMode(next);
                  setSemanticResults(null);
                  if (next === 'semantic' && search.trim()) runSemanticSearch(search);
                }}
                style={{
                  paddingHorizontal: 12,
                  height: 44,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: searchMode === 'semantic' ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: searchMode === 'semantic' ? 'rgba(124,58,237,0.50)' : 'rgba(255,255,255,0.10)',
                }}
              >
                <Text style={{ color: searchMode === 'semantic' ? '#a78bfa' : 'rgba(255,255,255,0.50)', fontSize: 12, fontWeight: '700' }}>
                  AI
                </Text>
              </Pressable>
              <Pressable
                onPress={toggleFilter}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: filterOpen ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: filterOpen ? 'rgba(124,58,237,0.40)' : 'rgba(255,255,255,0.10)',
                }}
              >
                <SlidersHorizontal size={18} color={filterOpen ? '#a78bfa' : 'rgba(255,255,255,0.70)'} strokeWidth={2} />
                {activeFilterCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#7c3aed',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '700' }}>
                      {activeFilterCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Animated filter dropdown */}
            <Animated.View style={[dropdownStyle, { paddingHorizontal: 4, marginBottom: filterOpen ? 10 : 0 }]}>
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > 0) setDropdownContentHeight(h);
                }}
                style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: 16,
                gap: 14,
              }}>
                {/* Tag filter */}
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 }}>
                    CATEGORY
                  </Text>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={['all', ...QUEST_TAGS] as const}
                    keyExtractor={(item) => item}
                    contentContainerStyle={{ gap: 6 }}
                    renderItem={({ item }) => (
                      <Chip
                        label={item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
                        selected={tagFilter === item}
                        color={item !== 'all' ? TAG_COLOURS[item] : undefined}
                        onPress={() => {
                          setTagFilter(item as typeof tagFilter);
                          if (item !== 'all') {
                            setSessionBoosts(prev => incrementSessionBoost(prev, item as QuestTag));
                          }
                        }}
                      />
                    )}
                  />
                </View>

                {/* Mode filter */}
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 }}>
                    MODE
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {MODE_OPTIONS.map(({ value, label }) => (
                      <Chip key={value} label={label} selected={modeFilter === value} onPress={() => setModeFilter(value)} />
                    ))}
                  </View>
                </View>

                {/* Quest type filter */}
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 }}>
                    TYPE
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {QUEST_TYPE_OPTIONS.map(({ value, label }) => (
                      <Chip key={value} label={label} selected={questTypeFilter === value} onPress={() => setQuestTypeFilter(value)} />
                    ))}
                  </View>
                </View>

                {/* Reward + Deadline in one row */}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 }}>
                      REWARD
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {REWARD_OPTIONS.map(({ value, label }) => (
                        <Chip key={value} label={label} selected={rewardFilter === value} onPress={() => setRewardFilter(value)} />
                      ))}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 }}>
                      DEADLINE
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {DEADLINE_OPTIONS.map(({ value, label }) => (
                        <Chip key={value} label={label} selected={deadlineFilter === value} onPress={() => setDeadlineFilter(value)} />
                      ))}
                    </View>
                  </View>
                </View>

                {/* Reset button */}
                {activeFilterCount > 0 && (
                  <Pressable onPress={resetFilters} style={{ alignSelf: 'flex-end' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, fontWeight: '500' }}>
                      Reset filters
                    </Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          </View>
        }
        ListEmptyComponent={
          loading || semanticLoading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <ActivityIndicator color={colors.textFaint} size="large" />
              {semanticLoading && (
                <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 12 }}>
                  Finding similar quests...
                </Text>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 24 }}>
              <Layers size={48} color={colors.textFaint} strokeWidth={1.5} />
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginTop: 16, letterSpacing: -0.3 }}>
                No quests found
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                {search || tagFilter !== 'all' || modeFilter !== 'all' || hasExtraFilters
                  ? 'Try adjusting your filters'
                  : 'Check back soon for new quests'}
              </Text>
            </View>
          )
        }
      />
      ) : (
        /* ── Broadcast feed ───────────────────────────── */
        <FlatList
          key="broadcast-list"
          data={routeOffers.filter((o) => {
            if (broadcastTagFilter !== 'all') {
              if (!o.tags || o.tags.length === 0) return true; // "can help with anything"
              if (!o.tags.includes(broadcastTagFilter)) return false;
            }
            if (broadcastSearch.trim()) {
              const s = broadcastSearch.toLowerCase();
              if (!o.destination_name.toLowerCase().includes(s)) return false;
            }
            return true;
          })}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textFaint} />
          }
          ListHeaderComponent={<View>{sharedHeader}</View>}
          ListEmptyComponent={
            loadingBroadcast ? (
              <View style={{ alignItems: 'center', paddingTop: 80 }}>
                <ActivityIndicator color={colors.textFaint} size="large" />
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 }}>
                <Navigation2 size={48} color={colors.textFaint} strokeWidth={1.5} />
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginTop: 16, letterSpacing: -0.3 }}>
                  No broadcasts right now
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                  Be the first — tap "Going out?" on the map
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <RouteOfferCard offer={item} currentUserId={session?.user?.id} />
          )}
        />
      )}
    </View>
  );
}
 