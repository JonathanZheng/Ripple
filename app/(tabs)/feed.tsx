import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { QuestCard } from '@/components/QuestCard';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTheme } from '@/lib/ThemeContext';
import { QUEST_TAGS, TAG_COLOURS } from '@/constants';
import { Search, Layers } from 'lucide-react-native';
import type { Quest, QuestTag, FulfilmentMode } from '@/types/database';

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

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  async function fetchQuests() {
    const { data, error } = await supabase
      .from('quests')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (!error && data) setQuests(data as Quest[]);
  }

  useFocusEffect(
    useCallback(() => {
      fetchQuests().finally(() => setLoading(false));
    }, []),
  );

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

  async function onRefresh() {
    setRefreshing(true);
    await fetchQuests();
    setRefreshing(false);
  }

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

  const hasExtraFilters = questTypeFilter !== 'all' || rewardFilter !== 'all' || deadlineFilter !== 'all';
  const userTier = profile?.trust_tier ?? 'wanderer';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <QuestCard quest={item} userTier={userTier} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textFaint} />
        }
        ListHeaderComponent={
          <View>
            <ScreenHeader title="Quests" subtitle="Discover requests near you" />

            {/* Search */}
            <View style={{ paddingHorizontal: 4, marginBottom: 14 }}>
              <Input
                leftIcon={Search}
                placeholder="Search quests..."
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                rounded
              />
            </View>

            {/* Tag filter */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['all', ...QUEST_TAGS] as const}
              keyExtractor={(item) => item}
              contentContainerStyle={{ paddingHorizontal: 4, gap: 6, marginBottom: 8 }}
              renderItem={({ item }) => (
                <Chip
                  label={item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
                  selected={tagFilter === item}
                  color={item !== 'all' ? TAG_COLOURS[item] : undefined}
                  onPress={() => setTagFilter(item as typeof tagFilter)}
                />
              )}
            />

            {/* Mode filter */}
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4, marginBottom: 8 }}>
              {MODE_OPTIONS.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={modeFilter === value}
                  onPress={() => setModeFilter(value)}
                />
              ))}
            </View>

            {/* Quest type filter */}
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4, marginBottom: 8 }}>
              {QUEST_TYPE_OPTIONS.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={questTypeFilter === value}
                  onPress={() => setQuestTypeFilter(value)}
                />
              ))}
            </View>

            {/* Reward range filter */}
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4, marginBottom: 8 }}>
              {REWARD_OPTIONS.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={rewardFilter === value}
                  onPress={() => setRewardFilter(value)}
                />
              ))}
            </View>

            {/* Deadline filter */}
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4, marginBottom: 16 }}>
              {DEADLINE_OPTIONS.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={deadlineFilter === value}
                  onPress={() => setDeadlineFilter(value)}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <ActivityIndicator color={colors.textFaint} size="large" />
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
    </View>
  );
}
