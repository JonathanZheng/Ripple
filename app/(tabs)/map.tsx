import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { RC_OPTIONS, TRUST_TIER_CONFIG } from '@/constants';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/lib/ThemeContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RefreshCw } from 'lucide-react-native';
import type { Profile } from '@/types/database';

type RCEntry = {
  rc: string;
  questCount: number;
  topContributor: { display_name: string; count: number; trust_tier: Profile['trust_tier'] } | null;
};

export default function LeaderboardScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const { profile: myProfile } = useProfile(userId);
  const insets = useSafeAreaInsets();

  const { colors } = useTheme();
  const [entries, setEntries] = useState<RCEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekLabel, setWeekLabel] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    setWeekLabel(`${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`);

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

    const uniqueIds = [...new Set(quests.map(q => q.acceptor_id as string))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, rc, trust_tier')
      .in('id', uniqueIds);

    if (!profiles) { setLoading(false); return; }

    const profileMap = new Map<string, typeof profiles[0]>();
    profiles.forEach(p => profileMap.set(p.id, p));

    const rcQuestCount: Record<string, number> = {};
    const userQuestCount: Record<string, number> = {};

    for (const q of quests) {
      const p = profileMap.get(q.acceptor_id as string);
      if (!p) continue;
      rcQuestCount[p.rc] = (rcQuestCount[p.rc] ?? 0) + 1;
      userQuestCount[p.id] = (userQuestCount[p.id] ?? 0) + 1;
    }

    const result: RCEntry[] = RC_OPTIONS.map(rc => {
      const questCount = rcQuestCount[rc] ?? 0;
      let topContributor: RCEntry['topContributor'] = null;
      let topCount = 0;
      profiles.filter(p => p.rc === rc).forEach(p => {
        const count = userQuestCount[p.id] ?? 0;
        if (count > topCount) {
          topCount = count;
          topContributor = { display_name: p.display_name, count, trust_tier: p.trust_tier as Profile['trust_tier'] };
        }
      });
      return { rc, questCount, topContributor };
    });

    result.sort((a, b) => b.questCount - a.questCount);
    setEntries(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const myRcRank = myProfile ? entries.findIndex(e => e.rc === myProfile.rc) + 1 : null;
  const topCount = entries[0]?.questCount ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <ScreenHeader
          title="RC Leaderboard"
          subtitle={weekLabel ? `Week of ${weekLabel}` : undefined}
          rightAction={
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              iconOnly
              onPress={fetchLeaderboard}
            />
          }
        />

        {/* My RC highlight */}
        {myProfile && myRcRank && myRcRank > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Card glow style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 4 }}>
                  YOUR COLLEGE
                </Text>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 18, letterSpacing: -0.4 }}>
                  {myProfile.rc}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, marginBottom: 2 }}>
                  Rank
                </Text>
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 28, letterSpacing: -1 }}>
                  #{myRcRank}
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Leaderboard */}
        {loading ? (
          <ActivityIndicator color="rgba(255,255,255,0.30)" style={{ marginTop: 60 }} />
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 8 }}>
            {entries.map((entry, i) => {
              const isMyRc = myProfile?.rc === entry.rc;
              const tierConfig = entry.topContributor
                ? TRUST_TIER_CONFIG[entry.topContributor.trust_tier]
                : null;

              return (
                <Card key={entry.rc} glow={isMyRc} variant={isMyRc ? 'elevated' : 'default'}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    {/* Rank indicator */}
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        backgroundColor: i < 3 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                        borderWidth: 1,
                        borderColor: i < 3 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{
                        color: i < 3 ? '#ffffff' : 'rgba(255,255,255,0.40)',
                        fontSize: i < 3 ? 15 : 13,
                        fontWeight: '700',
                      }}>
                        {i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : `${i + 1}`}
                      </Text>
                    </View>

                    {/* RC info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15, letterSpacing: -0.3 }}>
                          {entry.rc}
                        </Text>
                        {isMyRc && <Badge variant="default" value="You" />}
                      </View>
                      {entry.topContributor ? (
                        <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12 }}>
                          Top:{' '}
                          <Text style={{ color: tierConfig?.colour ?? 'rgba(255,255,255,0.60)', fontWeight: '600' }}>
                            {entry.topContributor.display_name}
                          </Text>
                          {'  ·  ' + entry.topContributor.count + ' quest' + (entry.topContributor.count !== 1 ? 's' : '')}
                        </Text>
                      ) : (
                        <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
                          No completions yet
                        </Text>
                      )}
                    </View>

                    {/* Count */}
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 20, letterSpacing: -0.5 }}>
                        {entry.questCount}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>quests</Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  {topCount > 0 && (
                    <View style={{ marginTop: 14 }}>
                      <ProgressBar
                        progress={entry.questCount / topCount}
                        color={isMyRc ? '#7c3aed' : 'rgba(255,255,255,0.20)'}
                        height={3}
                      />
                    </View>
                  )}
                </Card>
              );
            })}

            {entries.every(e => e.questCount === 0) && (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 15, letterSpacing: -0.2 }}>
                  No quests completed this week
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 4 }}>
                  Be the first to help your college
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
