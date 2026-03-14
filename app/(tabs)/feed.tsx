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
import { QUEST_TAGS, TAG_COLOURS } from '@/constants';
import { Search, Layers } from 'lucide-react-native';
import type { Quest, QuestTag, FulfilmentMode } from '@/types/database';

const MODE_OPTIONS: { value: FulfilmentMode | 'all'; label: string }[] = [
  { value: 'all',     label: 'Any' },
  { value: 'meetup',  label: 'Meet Up' },
  { value: 'dropoff', label: 'Drop Off' },
];

export default function Feed() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);

  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    if (search.trim()) {
      const s = search.toLowerCase();
      const haystack = `${q.title} ${q.description} ${q.ai_generated_title ?? ''}`.toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    return true;
  });

  const userTier = profile?.trust_tier ?? 'wanderer';

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <QuestCard quest={item} userTier={userTier} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.30)" />
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
              contentContainerStyle={{ paddingHorizontal: 4, gap: 6, marginBottom: 10 }}
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
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4, marginBottom: 16 }}>
              {MODE_OPTIONS.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={modeFilter === value}
                  onPress={() => setModeFilter(value)}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <ActivityIndicator color="rgba(255,255,255,0.30)" size="large" />
            </View>
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 24 }}>
              <Layers size={48} color="rgba(255,255,255,0.10)" strokeWidth={1.5} />
              <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16, marginTop: 16, letterSpacing: -0.3 }}>
                No quests found
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                {search || tagFilter !== 'all' || modeFilter !== 'all'
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
