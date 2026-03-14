import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { QuestCard } from '@/components/QuestCard';
import { QUEST_TAGS } from '@/constants';
import type { Quest, QuestTag, FulfilmentMode } from '@/types/database';

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

  // Refetch whenever this screen comes into focus (catches newly posted quests)
  useFocusEffect(
    useCallback(() => {
      fetchQuests().finally(() => setLoading(false));
    }, []),
  );

  // Real-time subscription: mount once, push new open quests to top
  useEffect(() => {
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
      <View className="px-5 pt-4 pb-6">
        <Text className="text-3xl font-bold text-white mb-1">Quests</Text>
        <Text className="text-muted text-sm">Discover requests near you</Text>
      </View>

      {/* Search */}
      <View className="px-5 mb-4">
        <TextInput
          className="bg-surface-2 text-white rounded-lg px-4 py-3 border border-surface-3 text-base"
          placeholder="Search quests..."
          placeholderTextColor="#6b7280"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {/* Tag filter chips */}
      <View className="px-5 mb-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', ...QUEST_TAGS] as const}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              className={`mr-2 px-3 py-1.5 rounded-full border transition-all ${
                tagFilter === item
                  ? 'bg-accent border-accent shadow-accent-sm'
                  : 'border-surface-3 bg-surface-2'
              }`}
              onPress={() => setTagFilter(item as typeof tagFilter)}
            >
              <Text
                className={`text-sm font-semibold ${
                  tagFilter === item ? 'text-white' : 'text-muted'
                }`}
              >
                {item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
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
            className={`px-3 py-1.5 rounded-full border transition-all ${
              modeFilter === m
                ? 'bg-accent border-accent shadow-accent-sm'
                : 'border-surface-3 bg-surface-2'
            }`}
            onPress={() => setModeFilter(m)}
          >
            <Text
              className={`text-xs font-semibold ${
                modeFilter === m ? 'text-white' : 'text-muted'
              }`}
            >
              {m === 'all' ? 'Any mode' : m === 'meetup' ? '📍 Meet Up' : '📦 Drop Off'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Quest list */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7c3aed" size="large" />
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
              tintColor="#7c3aed"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-white font-semibold text-base">No quests available</Text>
              <Text className="text-muted text-sm mt-2 text-center">
                {search || tagFilter !== 'all' || modeFilter !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Check back soon for new quests!'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
