import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow, isPast, addMinutes, subDays, startOfDay, isEqual } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { sendPushNotification } from '@/lib/notifications';
import { TRUST_TIER_CONFIG, TAG_COLOURS, GRACE_WINDOW_MINUTES } from '@/constants';
import type { Quest, Profile, Message, Rating, TrustTier } from '@/types/database';

// Updates streak_count and last_active_date for a user on quest completion
async function updateStreak(userId: string) {
  const { data: p } = await supabase
    .from('profiles')
    .select('streak_count, last_active_date')
    .eq('id', userId)
    .single();
  if (!p) return;

  const today = startOfDay(new Date());
  const todayStr = today.toISOString().split('T')[0];
  const lastActive = p.last_active_date ? startOfDay(new Date(p.last_active_date)) : null;

  if (lastActive && isEqual(lastActive, today)) return; // already updated today

  const isConsecutive = lastActive && isEqual(lastActive, subDays(today, 1));
  const newStreak = isConsecutive ? (p.streak_count ?? 0) + 1 : 1;

  await supabase
    .from('profiles')
    .update({ streak_count: newStreak, last_active_date: todayStr })
    .eq('id', userId);
}

function canAccept(quest: Quest, tier: TrustTier): { ok: boolean; reason?: string } {
  if (quest.tag === 'food' && tier === 'wanderer')
    return { ok: false, reason: 'Explorer+ required for food quests' };
  if (quest.reward_amount > 5 && tier === 'wanderer')
    return { ok: false, reason: 'Explorer+ required for rewards > $5' };
  return { ok: true };
}

function ProfileCard({
  label,
  profile,
  accentClass,
  textAccent,
}: {
  label: string;
  profile: Profile;
  accentClass: string;
  textAccent: string;
}) {
  const tierConfig = TRUST_TIER_CONFIG[profile.trust_tier];
  return (
    <View className="bg-surface rounded-2xl p-4">
      <Text className="text-muted text-xs mb-3">{label}</Text>
      <View className="flex-row items-center gap-3">
        <View className={`w-10 h-10 rounded-full items-center justify-center ${accentClass}`}>
          <Text style={{ color: textAccent }} className="font-bold text-base">
            {profile.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-white font-semibold">{profile.display_name}</Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            <Text className="text-muted text-xs">{profile.rc}</Text>
            <View className="w-1 h-1 rounded-full bg-surface-2" />
            <Text className="text-xs font-medium" style={{ color: tierConfig.colour }}>
              {tierConfig.label}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-yellow-400 text-sm">
            {'★'.repeat(Math.round(profile.avg_rating ?? 0))}
            {'☆'.repeat(5 - Math.round(profile.avg_rating ?? 0))}
          </Text>
          <Text className="text-muted text-xs mt-0.5">{(profile.avg_rating ?? 0).toFixed(1)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function QuestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [quest, setQuest] = useState<Quest | null>(null);
  const [posterProfile, setPosterProfile] = useState<Profile | null>(null);
  const [acceptorProfile, setAcceptorProfile] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedStars, setSelectedStars] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const acceptorFetched = useRef(false);

  const fetchAcceptorProfile = useCallback(async (acceptorId: string) => {
    if (acceptorFetched.current) return;
    acceptorFetched.current = true;
    const { data } = await supabase.from('profiles').select('*').eq('id', acceptorId).single();
    if (data) setAcceptorProfile(data as Profile);
  }, []);

  const fetchData = useCallback(async () => {
    if (!id || !userId) return;

    const [questRes, myProfileRes] = await Promise.all([
      supabase.from('quests').select('*').eq('id', id).single(),
      supabase.from('profiles').select('*').eq('id', userId).single(),
    ]);

    if (questRes.error || !questRes.data) { setLoading(false); return; }
    const q = questRes.data as Quest;
    setQuest(q);
    if (myProfileRes.data) setMyProfile(myProfileRes.data as Profile);

    const fetches: Promise<unknown>[] = [
      supabase.from('profiles').select('*').eq('id', q.poster_id).single().then(({ data }) => {
        if (data) setPosterProfile(data as Profile);
      }),
      supabase.from('messages').select('*').eq('quest_id', id).order('created_at').then(({ data }) => {
        if (data) setMessages(data as Message[]);
      }),
      supabase.from('ratings').select('*').eq('quest_id', id).eq('rater_id', userId).maybeSingle().then(({ data }) => {
        if (data) setMyRating(data as Rating);
      }),
    ];

    if (q.acceptor_id) fetches.push(fetchAcceptorProfile(q.acceptor_id));

    await Promise.all(fetches);
    setLoading(false);
  }, [id, userId, fetchAcceptorProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`quest-detail-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quests', filter: `id=eq.${id}` },
        async (payload) => {
          const updated = payload.new as Quest;
          setQuest(updated);
          if (updated.acceptor_id) fetchAcceptorProfile(updated.acceptor_id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `quest_id=eq.${id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
          setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, fetchAcceptorProfile]);

  // --- Actions ---

  const handleAccept = async () => {
    if (!quest || !userId || !myProfile) return;
    setActionLoading(true);

    const { error, count } = await supabase
      .from('quests')
      .update({ status: 'in_progress', acceptor_id: userId })
      .eq('id', quest.id)
      .eq('status', 'open') // safety: only accept if still open
      .select('id', { count: 'exact', head: true });

    if (error) {
      Alert.alert('Error', error.message);
    } else if (count === 0) {
      // RLS blocked or quest no longer open
      Alert.alert('Could not accept', 'This quest may have already been taken. Please go back and refresh the feed.');
    } else {
      // Update local state immediately — don't wait for real-time sub
      setQuest(prev => prev ? { ...prev, status: 'in_progress', acceptor_id: userId } : prev);
      setAcceptorProfile(myProfile);
      acceptorFetched.current = true;
      if (posterProfile?.push_token) {
        await sendPushNotification(
          posterProfile.push_token,
          'Quest Accepted!',
          `${myProfile.display_name} accepted: ${quest.title}`
        );
      }
    }
    setActionLoading(false);
  };

  const handleCancelQuest = () => {
    if (!quest) return;
    Alert.alert('Cancel Quest', 'This will expire the quest. Continue?', [
      { text: 'No' },
      {
        text: 'Cancel Quest', style: 'destructive', onPress: async () => {
          setActionLoading(true);
          await supabase.from('quests').update({ status: 'expired' }).eq('id', quest.id);
          setActionLoading(false);
          router.canGoBack() ? router.back() : router.replace('/(tabs)/feed');
        },
      },
    ]);
  };

  const handleDropOut = () => {
    if (!quest || !userId) return;
    const graceEnd = addMinutes(new Date(quest.created_at), GRACE_WINDOW_MINUTES);
    const pastGrace = new Date() > graceEnd;
    Alert.alert(
      'Drop Out',
      pastGrace
        ? 'You are past the 30-min grace window. Dropping out will result in an abandonment strike.'
        : 'Are you sure you want to drop out?',
      [
        { text: 'No' },
        {
          text: 'Drop Out', style: 'destructive', onPress: async () => {
            setActionLoading(true);
            if (pastGrace) {
              await supabase.from('strikes').insert({ user_id: userId, quest_id: quest.id, reason: 'abandonment' });
            }
            acceptorFetched.current = false;
            await supabase.from('quests').update({ status: 'open', acceptor_id: null }).eq('id', quest.id);
            setActionLoading(false);
            router.canGoBack() ? router.back() : router.replace('/(tabs)/feed');
          },
        },
      ]
    );
  };

  const handleSubmitPhoto = async () => {
    if (!quest || !userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    setActionLoading(true);
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const path = `${quest.id}/${userId}.${ext}`;

    const blob = await (await fetch(asset.uri)).blob();
    const { error: uploadError } = await supabase.storage
      .from('drop-off-photos')
      .upload(path, blob, { upsert: true });

    if (uploadError) {
      Alert.alert('Upload Error', uploadError.message);
      setActionLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('drop-off-photos').getPublicUrl(path);
    await supabase.from('quests').update({ drop_off_photo_url: publicUrl }).eq('id', quest.id);

    if (posterProfile?.push_token) {
      await sendPushNotification(posterProfile.push_token, 'Drop-Off Photo Submitted', 'Please confirm receipt.');
    }
    setActionLoading(false);
  };

  const handleConfirmReceipt = async () => {
    if (!quest) return;
    setActionLoading(true);
    await supabase.from('quests').update({ status: 'completed' }).eq('id', quest.id);
    if (acceptorProfile?.push_token) {
      await sendPushNotification(acceptorProfile.push_token, 'Quest Completed!', `${quest.title} — please rate your experience.`);
    }
    setActionLoading(false);
  };

  const handleMarkComplete = async () => {
    if (!quest) return;
    setActionLoading(true);
    await supabase.from('quests').update({ status: 'completed' }).eq('id', quest.id);
    if (acceptorProfile?.push_token) {
      await sendPushNotification(acceptorProfile.push_token, 'Quest Completed!', `${quest.title} — please rate your experience.`);
    }
    setActionLoading(false);
  };

  const handleRating = async () => {
    if (!quest || !userId || selectedStars === 0) return;
    setActionLoading(true);

    const isPoster = userId === quest.poster_id;
    const rateeId = isPoster ? quest.acceptor_id! : quest.poster_id;

    await supabase.from('ratings').insert({ quest_id: quest.id, rater_id: userId, ratee_id: rateeId, stars: selectedStars });

    const { data: allRatings } = await supabase.from('ratings').select('stars').eq('ratee_id', rateeId);
    if (allRatings && allRatings.length > 0) {
      const avg = allRatings.reduce((sum, r) => sum + r.stars, 0) / allRatings.length;
      await supabase.from('profiles').update({ avg_rating: avg }).eq('id', rateeId);
    }

    // Poster rating acceptor: increment quests_completed and update streak
    if (isPoster && quest.acceptor_id) {
      const { data: acc } = await supabase.from('profiles').select('quests_completed').eq('id', quest.acceptor_id).single();
      if (acc) {
        await supabase.from('profiles').update({ quests_completed: (acc.quests_completed ?? 0) + 1 }).eq('id', quest.acceptor_id);
      }
      await updateStreak(quest.acceptor_id);
    }

    await supabase.rpc('update_trust_tier', { user_id: rateeId });
    setRatingSubmitted(true);
    setActionLoading(false);
  };

  const handleNonPayment = () => {
    if (!quest || !userId) return;
    Alert.alert('Report Non-Payment', 'This will issue a strike against the poster.', [
      { text: 'Cancel' },
      {
        text: 'Report', style: 'destructive', onPress: async () => {
          setActionLoading(true);
          await supabase.from('strikes').insert({ user_id: quest.poster_id, quest_id: quest.id, reason: 'non_payment' });
          const { data: p } = await supabase.from('profiles').select('strikes').eq('id', quest.poster_id).single();
          if (p) await supabase.from('profiles').update({ strikes: (p.strikes ?? 0) + 1 }).eq('id', quest.poster_id);
          Alert.alert('Reported', 'A strike has been issued against the poster.');
          setActionLoading(false);
        },
      },
    ]);
  };

  const handleSendMessage = async () => {
    const text = messageText.trim();
    if (!text || !userId || !quest) return;
    setMessageText('');
    await supabase.from('messages').insert({ quest_id: quest.id, sender_id: userId, content: text });
    const otherProfile = userId === quest.poster_id ? acceptorProfile : posterProfile;
    if (otherProfile?.push_token) {
      await sendPushNotification(otherProfile.push_token, 'New Message', `${myProfile?.display_name ?? 'Someone'}: ${text}`);
    }
  };

  // --- Action area (context-sensitive) ---

  const renderActionArea = () => {
    if (!quest || !userId) return null;
    const isPoster = userId === quest.poster_id;
    const isAcceptor = userId === quest.acceptor_id;
    const myTier = (myProfile?.trust_tier ?? 'wanderer') as TrustTier;

    if (quest.status === 'open') {
      if (isPoster) {
        return (
          <View className="gap-3">
            <View className="bg-surface rounded-2xl p-4 items-center">
              <Text className="text-muted text-sm">Waiting for someone to accept...</Text>
            </View>
            <Pressable onPress={handleCancelQuest} className="border border-red-500/60 rounded-2xl py-3 items-center">
              <Text className="text-red-400 font-semibold">Cancel Quest</Text>
            </Pressable>
          </View>
        );
      }
      const eligibility = canAccept(quest, myTier);
      return eligibility.ok ? (
        <Pressable onPress={handleAccept} disabled={actionLoading} className="bg-accent rounded-2xl py-4 items-center">
          <Text className="text-white font-bold text-base">{actionLoading ? 'Accepting...' : 'Accept Quest'}</Text>
        </Pressable>
      ) : (
        <View className="bg-surface-2 rounded-2xl py-4 items-center gap-1">
          <Text className="text-muted font-semibold">Cannot Accept</Text>
          <Text className="text-muted text-xs">{eligibility.reason}</Text>
        </View>
      );
    }

    if (quest.status === 'in_progress') {
      if (isAcceptor) {
        if (quest.fulfilment_mode === 'dropoff' && !quest.drop_off_photo_url) {
          return (
            <View className="gap-3">
              <Pressable onPress={handleSubmitPhoto} disabled={actionLoading} className="bg-accent rounded-2xl py-4 items-center">
                <Text className="text-white font-bold">{actionLoading ? 'Uploading...' : 'Submit Drop-Off Photo'}</Text>
              </Pressable>
              <Pressable onPress={handleDropOut} className="border border-red-500/60 rounded-2xl py-3 items-center">
                <Text className="text-red-400 font-semibold">Drop Out</Text>
              </Pressable>
            </View>
          );
        }
        if (quest.fulfilment_mode === 'dropoff') {
          return (
            <View className="bg-surface-2 rounded-2xl p-4 items-center">
              <Text className="text-muted text-sm">Photo submitted — awaiting poster confirmation.</Text>
            </View>
          );
        }
        // meetup
        return (
          <View className="gap-3">
            <View className="bg-surface-2 rounded-2xl p-4 items-center">
              <Text className="text-muted text-sm">Awaiting poster to mark complete after meetup</Text>
            </View>
            <Pressable onPress={handleDropOut} className="border border-red-500/60 rounded-2xl py-3 items-center">
              <Text className="text-red-400 font-semibold">Drop Out</Text>
            </Pressable>
          </View>
        );
      }

      if (isPoster) {
        if (quest.fulfilment_mode === 'meetup') {
          return (
            <Pressable onPress={handleMarkComplete} disabled={actionLoading} className="bg-accent rounded-2xl py-4 items-center">
              <Text className="text-white font-bold">{actionLoading ? 'Completing...' : 'Mark Complete'}</Text>
            </Pressable>
          );
        }
        if (!quest.drop_off_photo_url) {
          return (
            <View className="bg-surface-2 rounded-2xl p-4 items-center">
              <Text className="text-muted text-sm">Waiting for drop-off photo...</Text>
            </View>
          );
        }
        return (
          <View className="gap-3">
            <Image source={{ uri: quest.drop_off_photo_url }} style={{ width: '100%', height: 200, borderRadius: 16 }} resizeMode="cover" />
            <Pressable onPress={handleConfirmReceipt} disabled={actionLoading} className="bg-accent rounded-2xl py-4 items-center">
              <Text className="text-white font-bold">{actionLoading ? 'Confirming...' : 'Confirm Receipt'}</Text>
            </Pressable>
          </View>
        );
      }
    }

    if (quest.status === 'completed') {
      const alreadyRated = ratingSubmitted || !!myRating;
      const canRate = (isPoster && !!quest.acceptor_id) || isAcceptor;

      if (alreadyRated || !canRate) {
        return (
          <View className="gap-3">
            <View className="bg-surface-2 rounded-2xl p-4 items-center">
              <Text className="text-white font-semibold">Quest Complete</Text>
              <Text className="text-muted text-xs mt-1">Thanks for using Ripple!</Text>
            </View>
            {isAcceptor && (
              <Pressable onPress={handleNonPayment} className="border border-red-500/40 rounded-2xl py-3 items-center">
                <Text className="text-red-400/70 text-sm">Report Non-Payment</Text>
              </Pressable>
            )}
          </View>
        );
      }

      return (
        <View className="bg-surface rounded-2xl p-4 gap-4">
          <Text className="text-white font-semibold text-center">Rate your experience</Text>
          <View className="flex-row justify-center gap-2">
            {[1, 2, 3, 4, 5].map(star => (
              <Pressable key={star} onPress={() => setSelectedStars(star)}>
                <Text style={{ fontSize: 36, color: star <= selectedStars ? '#fbbf24' : '#334155' }}>★</Text>
              </Pressable>
            ))}
          </View>
          {selectedStars > 0 && (
            <Pressable onPress={handleRating} disabled={actionLoading} className="bg-accent rounded-2xl py-3 items-center">
              <Text className="text-white font-bold">{actionLoading ? 'Submitting...' : 'Submit Rating'}</Text>
            </Pressable>
          )}
          <Text className="text-muted text-xs text-center">
            Remember to settle payment via PayNow or cash.
          </Text>
          {isAcceptor && (
            <Pressable onPress={handleNonPayment} className="border border-red-500/40 rounded-2xl py-2 items-center">
              <Text className="text-red-400/70 text-sm">Report Non-Payment</Text>
            </Pressable>
          )}
        </View>
      );
    }

    return null;
  };

  // --- Loading / error states ---

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#60a5fa" />
      </View>
    );
  }

  if (!quest) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-white text-lg">Quest not found</Text>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/feed')} className="mt-4">
          <Text className="text-accent">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const tagColour = TAG_COLOURS[quest.tag] ?? '#6b7280';
  const deadlineDate = new Date(quest.deadline);
  const timeLeft = isPast(deadlineDate) ? 'Expired' : `${formatDistanceToNow(deadlineDate)} left`;
  const showChat = quest.status === 'in_progress' || quest.status === 'completed';

  const statusStyle: Record<string, { bg: string; text: string }> = {
    open:        { bg: 'rgba(34,197,94,0.15)',  text: '#4ade80' },
    in_progress: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    completed:   { bg: 'rgba(168,85,247,0.15)', text: '#c084fc' },
    expired:     { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
    disputed:    { bg: 'rgba(239,68,68,0.15)',  text: '#f87171' },
  };
  const sc = statusStyle[quest.status] ?? statusStyle.expired;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-surface-2">
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/feed')} className="mr-3 p-1">
          <Text className="text-accent text-xl">←</Text>
        </Pressable>
        <Text className="text-white font-bold text-base flex-1" numberOfLines={1}>
          {quest.ai_generated_title ?? quest.title}
        </Text>
        <View style={{ backgroundColor: sc.bg }} className="rounded-full px-3 py-1">
          <Text style={{ color: sc.text }} className="text-xs font-semibold capitalize">
            {quest.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-4 pt-4 gap-4">
            {/* Tags */}
            <View className="flex-row gap-2 flex-wrap">
              <View className="rounded-full px-3 py-1" style={{ backgroundColor: tagColour + '33' }}>
                <Text style={{ color: tagColour }} className="text-xs font-semibold capitalize">{quest.tag}</Text>
              </View>
              <View className="bg-surface-2 rounded-full px-3 py-1">
                <Text className="text-muted text-xs">
                  {quest.fulfilment_mode === 'meetup' ? 'Meet Up' : 'Drop Off'}
                </Text>
              </View>
              {quest.is_flash && (
                <View className="bg-warning/20 border border-warning rounded-full px-3 py-1">
                  <Text className="text-warning text-xs font-semibold">Flash</Text>
                </View>
              )}
            </View>

            {/* Title + description */}
            <Text className="text-white text-xl font-bold leading-snug">
              {quest.ai_generated_title ?? quest.title}
            </Text>
            <Text className="text-muted leading-relaxed">{quest.description}</Text>

            {/* Reward / deadline / location */}
            <View className="bg-surface rounded-2xl p-4 flex-row justify-around">
              <View className="items-center">
                <Text className="text-muted text-xs mb-1">Reward</Text>
                <Text className="text-accent font-bold text-base">
                  {quest.reward_amount > 0 ? `$${quest.reward_amount.toFixed(2)}` : 'Favour'}
                </Text>
              </View>
              <View className="w-px bg-surface-2" />
              <View className="items-center">
                <Text className="text-muted text-xs mb-1">Deadline</Text>
                <Text className="text-white font-semibold text-sm">{timeLeft}</Text>
              </View>
              {quest.location_name ? (
                <>
                  <View className="w-px bg-surface-2" />
                  <View className="items-center flex-1 mx-2">
                    <Text className="text-muted text-xs mb-1">Location</Text>
                    <Text className="text-white text-sm text-center" numberOfLines={2}>{quest.location_name}</Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Poster info */}
            {posterProfile && (
              <ProfileCard label="Posted by" profile={posterProfile} accentClass="bg-accent/20" textAccent="#60a5fa" />
            )}

            {/* Acceptor info */}
            {acceptorProfile && (
              <ProfileCard label="Accepted by" profile={acceptorProfile} accentClass="bg-green-500/20" textAccent="#4ade80" />
            )}

            {/* Action area */}
            {renderActionArea()}
          </View>

          {/* Chat messages */}
          {showChat && (
            <View className="mt-6 px-4 gap-3">
              <Text className="text-muted text-xs font-semibold uppercase tracking-widest">Messages</Text>
              {messages.length === 0 ? (
                <Text className="text-muted text-sm text-center py-6">No messages yet. Say hello!</Text>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === userId;
                  return (
                    <View
                      key={msg.id}
                      style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}
                      className={`rounded-2xl px-4 py-2 ${isMe ? 'bg-accent' : 'bg-surface'}`}
                    >
                      <Text className="text-white text-sm">{msg.content}</Text>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>

        {/* Message input bar */}
        {showChat && (
          <View className="px-4 py-3 border-t border-surface-2 flex-row gap-2 items-center">
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor="#64748b"
              className="flex-1 bg-surface rounded-2xl px-4 py-3 text-white"
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />
            <Pressable
              onPress={handleSendMessage}
              disabled={!messageText.trim()}
              style={{ opacity: messageText.trim() ? 1 : 0.4 }}
              className="bg-accent rounded-2xl px-4 py-3"
            >
              <Text className="text-white font-semibold">Send</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
