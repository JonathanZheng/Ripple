import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { QuestCard } from '@/components/QuestCard';
import { QUEST_TAGS } from '@/constants';
import type { Quest, QuestTag, FulfilmentMode } from '@/types/database';

const TAG_EMOJI: Record<string, string> = {
  food: '🍜',
  transport: '🚌',
  social: '🎉',
  skills: '💡',
  errands: '📦',
};

export default function Feed() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);

  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [tagFilter, setTagFilter] = useState<QuestTag | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<FulfilmentMode | 'all'>('all');
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

  useEffect(() => {
    fetchQuests().finally(() => setLoading(false));

    // Real-time: push new open quests to the top without refresh
    channelRef.current = supabase
      .channel('quests-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quests' },
        (payload) => {
          const newQuest = payload.new as Quest;
          if (newQuest.status === 'open') {
            setQuests((prev) => [newQuest, ...prev]);
          }
        },
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await fetchQuests();
    setRefreshing(false);
  }

  const now = new Date();
  const filtered = quests.filter((q) => {
    // Drop expired quests so QuestCard never renders a null item
    if (new Date(q.deadline) <= now) return false;
    if (q.is_flash && q.flash_expires_at && new Date(q.flash_expires_at) <= now) return false;
    if (tagFilter !== 'all' && q.tag !== tagFilter) return false;
    if (modeFilter !== 'all' && q.fulfilment_mode !== modeFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      const haystack = `${q.title} ${q.description} ${q.ai_generated_title ?? ''}`.toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    return true;
  });

  const userTier = profile?.trust_tier ?? 'wanderer';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-white">Quests</Text>
        <Text className="text-muted text-sm">Active requests near you</Text>
      </View>

      {/* Search */}
      <View className="px-5 mb-3">
        <TextInput
          className="bg-surface text-white rounded-xl px-4 py-3"
          placeholder="Search quests…"
          placeholderTextColor="#6b7280"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {/* Tag filter chips */}
      <View className="px-5 mb-1">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', ...QUEST_TAGS] as const}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              className={`mr-2 px-3 py-1.5 rounded-full border ${
                tagFilter === item ? 'bg-accent border-accent' : 'border-surface-2'
              }`}
              onPress={() => setTagFilter(item as typeof tagFilter)}
            >
              <Text className={`text-sm ${tagFilter === item ? 'text-white' : 'text-muted'}`}>
                {item === 'all' ? '✦ All' : `${TAG_EMOJI[item]} ${item}`}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Mode filter */}
      <View className="flex-row px-5 gap-2 mb-4">
        {(['all', 'meetup', 'dropoff'] as const).map((m) => (
          <Pressable
            key={m}
            className={`px-3 py-1.5 rounded-full border ${
              modeFilter === m ? 'bg-surface-2 border-accent' : 'border-surface-2'
            }`}
            onPress={() => setModeFilter(m)}
          >
            <Text className={`text-xs ${modeFilter === m ? 'text-white' : 'text-muted'}`}>
              {m === 'all' ? 'Any mode' : m === 'meetup' ? '🤝 Meet Up' : '📬 Drop Off'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Quest list */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6c63ff" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <QuestCard quest={item} userTier={userTier} />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6c63ff"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-4xl mb-3">🌊</Text>
              <Text className="text-white font-semibold text-base">No quests yet</Text>
              <Text className="text-muted text-sm mt-1 text-center">
                {search || tagFilter !== 'all' || modeFilter !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Be the first to post one!'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
