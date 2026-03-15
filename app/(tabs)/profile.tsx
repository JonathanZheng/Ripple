import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { TRUST_TIER_CONFIG, TAG_COLOURS } from '@/constants';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { X, Plus, Flame, AlertTriangle, Layers } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { Pressable } from 'react-native';
import type { Profile, Quest } from '@/types/database';

type Tab = 'posted' | 'inprogress' | 'completed';

const TABS: { value: Tab; label: string }[] = [
  { value: 'posted',     label: 'Posted'      },
  { value: 'inprogress', label: 'In Progress' },
  { value: 'completed',  label: 'Completed'   },
];

export default function ProfileScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const insets = useSafeAreaInsets();

  const { colors } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('posted');
  const [postedQuests, setPostedQuests] = useState<Quest[]>([]);
  const [inProgressQuests, setInProgressQuests] = useState<Quest[]>([]);
  const [completedQuests, setCompletedQuests] = useState<Quest[]>([]);
  const [localSkills, setLocalSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      async function load() {
        setLoading(true);
        const [profileRes, postedRes, inProgressRes, completedRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).single(),
          supabase.from('quests').select('*').eq('poster_id', userId).order('created_at', { ascending: false }),
          supabase.from('quests').select('*').or(`poster_id.eq.${userId},acceptor_id.eq.${userId}`).eq('status', 'in_progress'),
          supabase.from('quests').select('*').eq('acceptor_id', userId).eq('status', 'completed').order('created_at', { ascending: false }),
        ]);
        if (profileRes.data) { const p = profileRes.data as Profile; setProfile(p); setLocalSkills(p.skills ?? []); }
        if (postedRes.data) setPostedQuests(postedRes.data as Quest[]);
        if (inProgressRes.data) setInProgressQuests(inProgressRes.data as Quest[]);
        if (completedRes.data) setCompletedQuests(completedRes.data as Quest[]);
        setLoading(false);
      }
      load();
    }, [userId])
  );

  const handleAddSkill = async () => {
    const skill = skillInput.trim();
    if (!skill || !userId) return;
    const newSkills = [...localSkills, skill];
    setLocalSkills(newSkills);
    setSkillInput('');
    await supabase.from('profiles').update({ skills: newSkills }).eq('id', userId);
  };

  const handleRemoveSkill = async (index: number) => {
    if (!userId) return;
    const newSkills = localSkills.filter((_, i) => i !== index);
    setLocalSkills(newSkills);
    await supabase.from('profiles').update({ skills: newSkills }).eq('id', userId);
  };

  if (loading && !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="rgba(255,255,255,0.30)" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>No profile found.</Text>
      </View>
    );
  }

  const tierConfig = TRUST_TIER_CONFIG[profile.trust_tier];
  const tabQuests: Quest[] =
    activeTab === 'posted' ? postedQuests :
    activeTab === 'inprogress' ? inProgressQuests :
    completedQuests;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <ScreenHeader title="Profile" />

        {/* Profile hero */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Card variant="elevated">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Avatar name={profile.display_name} size="lg" tierColor={tierConfig.colour} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 19, fontWeight: '700', letterSpacing: -0.5, marginBottom: 3 }}>
                  {profile.display_name}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 8 }}>
                  {profile.rc}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Badge variant="tier" value={profile.trust_tier} color={tierConfig.colour} />
                  {(profile.streak_count ?? 0) > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.20)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Flame size={12} color="#f59e0b" strokeWidth={2.5} />
                      <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700' }}>
                        {profile.streak_count}d
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, overflow: 'hidden' }}>
              {[
                { label: 'Posted', value: String(postedQuests.length) },
                { label: 'Completed', value: String(completedQuests.length) },
                { label: 'Rating', value: (profile.avg_rating ?? 0).toFixed(1), color: '#f59e0b' },
              ].map((stat, i, arr) => (
                <View key={stat.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: 'rgba(255,255,255,0.06)' }}>
                  <Text style={{ color: stat.color ?? '#ffffff', fontWeight: '800', fontSize: 20, letterSpacing: -0.5, marginBottom: 3 }}>
                    {stat.value}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '500' }}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* Strikes warning */}
        {(profile.strikes ?? 0) > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.20)' }}>
              <AlertTriangle size={16} color="#ef4444" strokeWidth={2} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14, marginBottom: 2 }}>
                  {profile.strikes} Strike{profile.strikes > 1 ? 's' : ''}
                </Text>
                <Text style={{ color: 'rgba(239,68,68,0.70)', fontSize: 13 }}>
                  {profile.strikes >= 3 ? 'Account under review' : `${3 - profile.strikes} more until review`}
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Skills */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 }}>
            SKILLS & INTERESTS
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {localSkills.map((skill, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(124,58,237,0.10)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ color: '#a78bfa', fontSize: 13, fontWeight: '500' }}>{skill}</Text>
                <Pressable onPress={() => handleRemoveSkill(i)} hitSlop={8}>
                  <X size={12} color="rgba(167,139,250,0.50)" strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Add a skill..."
                value={skillInput}
                onChangeText={setSkillInput}
                returnKeyType="done"
                onSubmitEditing={handleAddSkill}
                leftIcon={Plus}
              />
            </View>
            <Button
              variant="secondary"
              size="md"
              onPress={handleAddSkill}
              disabled={!skillInput.trim()}
            >
              Add
            </Button>
          </View>
        </View>

        {/* Quest history */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 }}>
            QUEST HISTORY
          </Text>

          {/* Tab selector */}
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, gap: 4, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
            {TABS.map(({ value, label }) => (
              <View
                key={value}
                style={{ flex: 1, borderRadius: 10, backgroundColor: activeTab === value ? '#ffffff' : 'transparent', overflow: 'hidden' }}
              >
                <Chip
                  label={label}
                  selected={activeTab === value}
                  onPress={() => setActiveTab(value)}
                  style={{
                    width: '100%',
                    alignItems: 'center',
                    paddingHorizontal: 4,
                    borderRadius: 10,
                    borderWidth: 0,
                    backgroundColor: 'transparent',
                  }}
                />
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color="rgba(255,255,255,0.30)" style={{ marginTop: 24 }} />
          ) : tabQuests.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Layers size={36} color="rgba(255,255,255,0.08)" strokeWidth={1.5} />
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 12 }}>
                No quests here yet
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {tabQuests.map(quest => (
                <Card
                  key={quest.id}
                  onPress={() => router.push(`/quest/${quest.id}`)}
                >
                  {/* Tag color accent */}
                  <View style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderRadius: 999, backgroundColor: (TAG_COLOURS as Record<string, string>)[quest.tag] ?? 'rgba(255,255,255,0.20)' }} />
                  <View style={{ paddingLeft: 12 }}>
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15, letterSpacing: -0.3, marginBottom: 8 }} numberOfLines={1}>
                      {quest.ai_generated_title ?? quest.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Badge variant="status" value={quest.status} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ color: '#a78bfa', fontWeight: '700', fontSize: 13 }}>
                          {quest.reward_amount > 0 ? `$${quest.reward_amount.toFixed(2)}` : 'Favour'}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 12 }}>
                          {formatDistanceToNow(new Date(quest.deadline), { addSuffix: true })}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
