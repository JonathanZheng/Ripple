import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { TRUST_TIER_CONFIG } from '@/constants';
import type { Profile, Quest } from '@/types/database';

type Tab = 'posted' | 'inprogress' | 'completed';

export default function ProfileScreen() {
  const { session } = useSession();
  const userId = session?.user?.id;

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
          supabase.from('quests').select('*')
            .or(`poster_id.eq.${userId},acceptor_id.eq.${userId}`)
            .eq('status', 'in_progress'),
          supabase.from('quests').select('*')
            .eq('acceptor_id', userId).eq('status', 'completed').order('created_at', { ascending: false }),
        ]);

        if (profileRes.data) {
          const p = profileRes.data as Profile;
          setProfile(p);
          setLocalSkills(p.skills ?? []);
        }
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading && !profile) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-white text-base font-semibold">No profile found.</Text>
      </View>
    );
  }

  const tierConfig = TRUST_TIER_CONFIG[profile.trust_tier];
  const initials = profile.display_name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const tabQuests: Quest[] =
    activeTab === 'posted' ? postedQuests :
    activeTab === 'inprogress' ? inProgressQuests :
    completedQuests;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header with profile info */}
        <View className="px-5 pt-6 pb-6 gap-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-row items-center gap-4 flex-1">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center shadow-md"
                style={{ backgroundColor: tierConfig.colour + '20' }}
              >
                <Text style={{ color: tierConfig.colour }} className="text-2xl font-bold">{initials}</Text>
              </View>

              <View className="flex-1">
                <Text className="text-white text-xl font-bold">{profile.display_name}</Text>
                <Text className="text-muted text-sm mt-0.5">{profile.rc}</Text>
                <View className="flex-row items-center gap-2 mt-2">
                  <View
                    className="rounded-full px-3 py-1"
                    style={{ backgroundColor: tierConfig.colour + '15' }}
                  >
                    <Text className="text-xs font-bold" style={{ color: tierConfig.colour }}>
                      {tierConfig.label}
                    </Text>
                  </View>
                  {(profile.streak_count ?? 0) > 0 && (
                    <View className="bg-warning/15 rounded-full px-2 py-1">
                      <Text className="text-warning text-xs font-bold">
                        🔥 {profile.streak_count}d
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <Pressable onPress={handleSignOut} className="p-2 -mr-2">
              <Text className="text-muted text-xs font-semibold">Sign out</Text>
            </Pressable>
          </View>

          {/* Stats row */}
          <View className="bg-surface-2 rounded-2xl p-4 border border-surface-3 flex-row justify-around">
            <View className="items-center flex-1">
              <Text className="text-white font-bold text-xl">{postedQuests.length}</Text>
              <Text className="text-muted text-xs mt-1 font-semibold">Posted</Text>
            </View>
            <View className="w-px bg-surface-3" />
            <View className="items-center flex-1">
              <Text className="text-white font-bold text-xl">{profile.quests_completed ?? 0}</Text>
              <Text className="text-muted text-xs mt-1 font-semibold">Completed</Text>
            </View>
            <View className="w-px bg-surface-3" />
            <View className="items-center flex-1">
              <Text className="text-warning font-bold text-xl">{(profile.avg_rating ?? 0).toFixed(1)}</Text>
              <Text className="text-muted text-xs mt-1 font-semibold">Rating</Text>
            </View>
          </View>
        </View>

        {/* Strikes warning */}
        {(profile.strikes ?? 0) > 0 && (
          <View className="mx-5 mb-4 bg-danger/10 border border-danger/30 rounded-2xl px-4 py-3 flex-row items-center gap-3">
            <Text className="text-danger text-lg">⚠️</Text>
            <View className="flex-1">
              <Text className="text-danger font-bold text-sm">
                {profile.strikes} Strike{profile.strikes > 1 ? 's' : ''}
              </Text>
              <Text className="text-danger/70 text-xs mt-0.5">
                {profile.strikes >= 3
                  ? 'Account under review'
                  : `${3 - profile.strikes} more until review`}
              </Text>
            </View>
          </View>
        )}

        {/* Skills section */}
        <View className="mx-5 mb-6 gap-3">
          <Text className="text-white font-bold text-base">Skills & Interests</Text>
          <View className="flex-row flex-wrap gap-2">
            {localSkills.map((skill, i) => (
              <Pressable
                key={i}
                onPress={() => handleRemoveSkill(i)}
                className="bg-accent/15 border border-accent/40 rounded-full px-3 py-1.5 flex-row items-center gap-1.5"
              >
                <Text className="text-accent text-sm font-semibold">{skill}</Text>
                <Text className="text-accent/60 text-xs font-bold">×</Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row gap-2">
            <TextInput
              value={skillInput}
              onChangeText={setSkillInput}
              placeholder="Add a skill..."
              placeholderTextColor="#6b7280"
              className="flex-1 bg-surface-2 rounded-lg px-4 py-3 text-white text-sm border border-surface-3"
              returnKeyType="done"
              onSubmitEditing={handleAddSkill}
            />
            <Pressable
              onPress={handleAddSkill}
              disabled={!skillInput.trim()}
              style={{ opacity: skillInput.trim() ? 1 : 0.4 }}
              className="bg-accent rounded-lg px-4 py-3 items-center justify-center"
            >
              <Text className="text-white font-bold text-sm">Add</Text>
            </Pressable>
          </View>
          {localSkills.length > 0 && (
            <Text className="text-muted text-xs">Tap a skill to remove it.</Text>
          )}
        </View>

        {/* Quest history */}
        <View className="mx-5 gap-4">
          <Text className="text-white font-bold text-base">Quest History</Text>

          <View className="flex-row bg-surface-2 rounded-lg p-1 gap-1 border border-surface-3">
            {([['posted', 'Posted'], ['inprogress', 'In Progress'], ['completed', 'Completed']] as [Tab, string][]).map(
              ([tab, label]) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 rounded-md py-2.5 items-center transition-all ${activeTab === tab ? 'bg-accent shadow-accent-sm' : ''}`}
                >
                  <Text className={`text-xs font-bold ${activeTab === tab ? 'text-white' : 'text-muted'}`}>
                    {label}
                  </Text>
                </Pressable>
              )
            )}
          </View>

          {loading ? (
            <ActivityIndicator color="#7c3aed" style={{ marginTop: 24 }} />
          ) : tabQuests.length === 0 ? (
            <View className="py-12 items-center">
              <Text className="text-muted text-sm">No quests here yet.</Text>
            </View>
          ) : (
            tabQuests.map(quest => (
              <Pressable
                key={quest.id}
                onPress={() => router.push(`/quest/${quest.id}`)}
                className="bg-surface-2 rounded-xl p-4 border border-surface-3 shadow-sm active:shadow-md active:opacity-95"
              >
                <Text className="text-white font-bold text-base" numberOfLines={1}>
                  {quest.ai_generated_title ?? quest.title}
                </Text>
                <View className="flex-row items-center justify-between mt-3">
                  <Text className="text-accent font-bold text-sm">
                    {quest.reward_amount > 0 ? `$${quest.reward_amount.toFixed(2)}` : 'Favour'}
                  </Text>
                  <Text className="text-muted text-xs">
                    {formatDistanceToNow(new Date(quest.deadline), { addSuffix: true })}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
