import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { RC_OPTIONS, TRUST_TIER_CONFIG } from '@/constants';
import type { Profile } from '@/types/database';

type RCEntry = {
  rc: string;
  questCount: number;
  topContributor: { display_name: string; count: number; trust_tier: Profile['trust_tier'] } | null;
};

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const { profile: myProfile } = useProfile(userId);

  const [entries, setEntries] = useState<RCEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekLabel, setWeekLabel] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    setWeekLabel(`${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`);

    // Fetch all completed quests this week with acceptor_id set
    const { data: quests } = await supabase
      .from('quests')
      .select('acceptor_id')
      .eq('status', 'completed')
      .not('acceptor_id', 'is', null)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    if (!quests || quests.length === 0) {
      setEntries(RC_OPTIONS.map(rc => ({ rc, questCount: 0, topContributor: null })));
      setLoading(false);
      return;
    }

    // Fetch unique acceptor profiles
    const uniqueIds = [...new Set(quests.map(q => q.acceptor_id as string))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, rc, trust_tier')
      .in('id', uniqueIds);

    if (!profiles) { setLoading(false); return; }

    // Build a map: acceptorId → profile
    const profileMap = new Map<string, typeof profiles[0]>();
    profiles.forEach(p => profileMap.set(p.id, p));

    // Count quests per RC and per user
    const rcQuestCount: Record<string, number> = {};
    const userQuestCount: Record<string, number> = {};

    for (const q of quests) {
      const p = profileMap.get(q.acceptor_id as string);
      if (!p) continue;
      rcQuestCount[p.rc] = (rcQuestCount[p.rc] ?? 0) + 1;
      userQuestCount[p.id] = (userQuestCount[p.id] ?? 0) + 1;
    }

    // Build leaderboard entries for each RC
    const result: RCEntry[] = RC_OPTIONS.map(rc => {
      const questCount = rcQuestCount[rc] ?? 0;

      // Find top contributor in this RC
      let topContributor: RCEntry['topContributor'] = null;
      let topCount = 0;
      profiles
        .filter(p => p.rc === rc)
        .forEach(p => {
          const count = userQuestCount[p.id] ?? 0;
          if (count > topCount) {
            topCount = count;
            topContributor = { display_name: p.display_name, count, trust_tier: p.trust_tier as Profile['trust_tier'] };
          }
        });

      return { rc, questCount, topContributor };
    });

    // Sort by quest count descending
    result.sort((a, b) => b.questCount - a.questCount);
    setEntries(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const myRcRank = myProfile
    ? entries.findIndex(e => e.rc === myProfile.rc) + 1
    : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="px-4 pt-6 pb-2">
          <Text className="text-white text-2xl font-bold">RC Leaderboard</Text>
          <Text className="text-muted text-sm mt-1">Week of {weekLabel}</Text>
        </View>

        {/* My RC highlight */}
        {myProfile && myRcRank && myRcRank > 0 && (
          <View className="mx-4 my-3 bg-accent/10 border border-accent/30 rounded-2xl px-4 py-3 flex-row items-center justify-between">
            <View>
              <Text className="text-accent text-xs font-semibold uppercase tracking-wider">Your RC</Text>
              <Text className="text-white font-bold text-base mt-0.5">{myProfile.rc}</Text>
            </View>
            <View className="items-end">
              <Text className="text-muted text-xs">Current rank</Text>
              <Text className="text-accent font-bold text-2xl">
                {myRcRank <= 3 ? MEDAL[myRcRank - 1] : `#${myRcRank}`}
              </Text>
            </View>
          </View>
        )}

        {/* Refresh */}
        <Pressable onPress={fetchLeaderboard} className="mx-4 mb-2">
          <Text className="text-accent text-xs text-right">Refresh</Text>
        </Pressable>

        {/* Leaderboard list */}
        {loading ? (
          <ActivityIndicator color="#60a5fa" style={{ marginTop: 48 }} />
        ) : (
          <View className="px-4 gap-3">
            {entries.map((entry, i) => {
              const isMyRc = myProfile?.rc === entry.rc;
              const tierConfig = entry.topContributor
                ? TRUST_TIER_CONFIG[entry.topContributor.trust_tier]
                : null;

              return (
                <View
                  key={entry.rc}
                  className={`rounded-2xl p-4 border ${
                    isMyRc ? 'border-accent/50 bg-accent/5' : 'border-surface-2 bg-surface'
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    {/* Rank */}
                    <View className="w-10 items-center">
                      {i < 3 ? (
                        <Text style={{ fontSize: 24 }}>{MEDAL[i]}</Text>
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-surface-2 items-center justify-center">
                          <Text className="text-muted font-bold text-sm">#{i + 1}</Text>
                        </View>
                      )}
                    </View>

                    {/* RC info */}
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-white font-bold text-base">{entry.rc}</Text>
                        {isMyRc && (
                          <View className="bg-accent/20 rounded-full px-2 py-0.5">
                            <Text className="text-accent text-xs font-semibold">You</Text>
                          </View>
                        )}
                      </View>

                      {entry.topContributor ? (
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <Text className="text-muted text-xs">Top: </Text>
                          <Text className="text-xs font-medium" style={{ color: tierConfig?.colour ?? '#94a3b8' }}>
                            {entry.topContributor.display_name}
                          </Text>
                          <Text className="text-muted text-xs">
                            · {entry.topContributor.count} quest{entry.topContributor.count !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-muted text-xs mt-0.5">No completions yet</Text>
                      )}
                    </View>

                    {/* Quest count */}
                    <View className="items-end">
                      <Text className="text-white font-bold text-xl">{entry.questCount}</Text>
                      <Text className="text-muted text-xs">quests</Text>
                    </View>
                  </View>

                  {/* Progress bar (relative to top RC) */}
                  {entries[0].questCount > 0 && (
                    <View className="mt-3 bg-surface-2 rounded-full h-1.5 overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${(entry.questCount / entries[0].questCount) * 100}%`,
                          backgroundColor: isMyRc ? '#60a5fa' : '#334155',
                        }}
                      />
                    </View>
                  )}
                </View>
              );
            })}

            {entries.every(e => e.questCount === 0) && (
              <View className="py-12 items-center">
                <Text className="text-muted text-sm">No quests completed this week yet.</Text>
                <Text className="text-muted text-xs mt-1">Be the first to help your RC climb the ranks!</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
