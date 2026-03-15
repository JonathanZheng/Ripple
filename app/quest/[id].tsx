import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  Pressable,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow, isPast, addMinutes, subDays, startOfDay, isEqual } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { sendPushNotification } from '@/lib/notifications';
import { TRUST_TIER_CONFIG, TAG_COLOURS, GRACE_WINDOW_MINUTES } from '@/constants';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { GlassView } from '@/components/ui/GlassView';
import { DollarSign, Clock, MapPin, Send, Star, Camera, Navigation, Users, MessageCircle } from 'lucide-react-native';
import { Chip } from '@/components/ui/Chip';
import { useTheme } from '@/lib/ThemeContext';
import type { Quest, Profile, Message, Rating, TrustTier } from '@/types/database';

function webConfirm(title: string, message: string, onConfirm: () => void, confirmLabel = 'Confirm') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'No' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  }
}

async function updateStreak(userId: string) {
  const { data: p } = await supabase.from('profiles').select('streak_count, last_active_date').eq('id', userId).single();
  if (!p) return;
  const today = startOfDay(new Date());
  const todayStr = today.toISOString().split('T')[0];
  const lastActive = p.last_active_date ? startOfDay(new Date(p.last_active_date)) : null;
  if (lastActive && isEqual(lastActive, today)) return;
  const isConsecutive = lastActive && isEqual(lastActive, subDays(today, 1));
  const newStreak = isConsecutive ? (p.streak_count ?? 0) + 1 : 1;
  await supabase.from('profiles').update({ streak_count: newStreak, last_active_date: todayStr }).eq('id', userId);
}

function canAccept(quest: Quest, tier: TrustTier): { ok: boolean; reason?: string } {
  if (quest.tag === 'food' && tier === 'wanderer') return { ok: false, reason: 'Explorer+ required for food quests' };
  if (quest.reward_amount > 5 && tier === 'wanderer') return { ok: false, reason: 'Explorer+ required for rewards > $5' };
  return { ok: true };
}

function ProfileCard({ label, profile }: { label: string; profile: Profile }) {
  const tierConfig = TRUST_TIER_CONFIG[profile.trust_tier];
  const rating = profile.avg_rating ?? 0;
  const fullStars = Math.round(rating);

  return (
    <Card>
      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 12 }}>
        {label.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={profile.display_name} size="md" tierColor={tierConfig.colour} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15, letterSpacing: -0.3, marginBottom: 3 }}>
            {profile.display_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12 }}>{profile.rc}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</Text>
            <Text style={{ color: tierConfig.colour, fontSize: 12, fontWeight: '600' }}>{tierConfig.label}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1,2,3,4,5].map(s => (
              <Star
                key={s}
                size={13}
                color={s <= fullStars ? '#fbbf24' : 'rgba(255,255,255,0.15)'}
                fill={s <= fullStars ? '#fbbf24' : 'transparent'}
                strokeWidth={1.5}
              />
            ))}
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{rating.toFixed(1)}</Text>
        </View>
      </View>
    </Card>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
      {[1,2,3,4,5].map(star => {
        const scale = useSharedValue(1);
        const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
        return (
          <Animated.View key={star} style={animStyle}>
            <Pressable
              onPressIn={() => { scale.value = withSpring(1.25, { damping: 12, stiffness: 300 }); }}
              onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
              onPress={() => onChange(star)}
            >
              <Star
                size={36}
                color={star <= value ? '#fbbf24' : 'rgba(255,255,255,0.18)'}
                fill={star <= value ? '#fbbf24' : 'transparent'}
                strokeWidth={1.5}
              />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

export default function QuestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user?.id;
  const insets = useSafeAreaInsets();

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
  const [crewCount, setCrewCount] = useState(0);
  const [isCrewMember, setIsCrewMember] = useState(false);
  const [activeView, setActiveView] = useState<'details' | 'chat'>('details');
  const scrollRef = useRef<ScrollView>(null);
  const chatListRef = useRef<FlatList>(null);
  const acceptorFetched = useRef(false);
  const { colors } = useTheme();

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
      supabase.from('profiles').select('*').eq('id', q.poster_id).single().then(({ data }) => { if (data) setPosterProfile(data as Profile); }),
      supabase.from('messages').select('*').eq('quest_id', id).order('created_at').then(({ data }) => { if (data) setMessages(data as Message[]); }),
      supabase.from('ratings').select('*').eq('quest_id', id).eq('rater_id', userId).maybeSingle().then(({ data }) => { if (data) setMyRating(data as Rating); }),
      supabase.from('crew_members').select('*').eq('quest_id', id).eq('status', 'active').then(({ data }) => {
        if (data) {
          setCrewCount(data.length);
          setIsCrewMember(data.some((m: any) => m.user_id === userId));
        }
      }),
    ];
    if (q.acceptor_id) fetches.push(fetchAcceptorProfile(q.acceptor_id));
    await Promise.all(fetches);
    setLoading(false);
  }, [id, userId, fetchAcceptorProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`quest-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quests', filter: `id=eq.${id}` }, async (payload) => {
        const updated = payload.new as Quest;
        setQuest(updated);
        if (updated.acceptor_id) fetchAcceptorProfile(updated.acceptor_id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `quest_id=eq.${id}` }, (payload) => {
        const incoming = payload.new as Message;
        setMessages(prev => {
          // Remove any matching optimistic temp message, then append the real one
          const filtered = prev.filter(m => !(
            (m.id as string).startsWith('temp-') &&
            m.sender_id === incoming.sender_id &&
            m.content === incoming.content
          ));
          return [...filtered, incoming];
        });
        setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, fetchAcceptorProfile]);

  const handleAccept = async () => {
    if (!quest || !userId || !myProfile) return;
    setActionLoading(true);
    const { error, count } = await supabase.from('quests').update({ status: 'in_progress', acceptor_id: userId }).eq('id', quest.id).eq('status', 'open').select('id', { count: 'exact', head: true });
    if (error) { Alert.alert('Error', error.message); }
    else if (count === 0) { Alert.alert('Could not accept', 'This quest may have already been taken.'); }
    else {
      setQuest(prev => prev ? { ...prev, status: 'in_progress', acceptor_id: userId } : prev);
      setAcceptorProfile(myProfile);
      acceptorFetched.current = true;
      if (posterProfile?.push_token) await sendPushNotification(posterProfile.push_token, 'Quest Accepted!', `${myProfile.display_name} accepted: ${quest.title}`);
    }
    setActionLoading(false);
  };

  const handleJoinCrew = async () => {
    if (!quest || !userId || !myProfile) return;
    setActionLoading(true);
    const { error } = await supabase.from('crew_members').insert({ quest_id: quest.id, user_id: userId });
    if (error) { Alert.alert('Error', error.message); setActionLoading(false); return; }
    const newCount = crewCount + 1;
    setCrewCount(newCount);
    setIsCrewMember(true);
    const maxAcc = (quest as any).max_acceptors ?? 1;
    if (newCount >= maxAcc) {
      await supabase.from('quests').update({ status: 'in_progress' }).eq('id', quest.id);
      setQuest(prev => prev ? { ...prev, status: 'in_progress' } : prev);
    }
    if (posterProfile?.push_token) await sendPushNotification(posterProfile.push_token, 'Crew Member Joined!', `${myProfile.display_name} joined your quest.`);
    setActionLoading(false);
  };

  const handleLeaveCrewQuest = () => {
    if (!quest || !userId) return;
    webConfirm('Leave Crew', 'Are you sure you want to leave this crew quest?', async () => {
      setActionLoading(true);
      await supabase.from('crew_members').update({ status: 'dropped_out' }).eq('quest_id', quest.id).eq('user_id', userId);
      setIsCrewMember(false);
      setCrewCount(prev => Math.max(0, prev - 1));
      setActionLoading(false);
    }, 'Leave');
  };

  const handleCancelQuest = () => {
    if (!quest) return;
    webConfirm('Cancel Quest', 'This will expire the quest. Continue?', async () => {
      setActionLoading(true);
      await supabase.from('quests').update({ status: 'expired' }).eq('id', quest.id);
      setActionLoading(false);
      router.canGoBack() ? router.back() : router.replace('/(tabs)/feed');
    }, 'Cancel Quest');
  };

  const handleDropOut = () => {
    if (!quest || !userId) return;
    const graceEnd = addMinutes(new Date(quest.created_at), GRACE_WINDOW_MINUTES);
    const pastGrace = new Date() > graceEnd;
    webConfirm('Drop Out', pastGrace ? 'You are past the grace window. Dropping out will result in a strike.' : 'Are you sure you want to drop out?', async () => {
      setActionLoading(true);
      if (pastGrace) await supabase.from('strikes').insert({ user_id: userId, quest_id: quest.id, reason: 'abandonment' });
      acceptorFetched.current = false;
      await supabase.from('quests').update({ status: 'open', acceptor_id: null }).eq('id', quest.id);
      setActionLoading(false);
      router.canGoBack() ? router.back() : router.replace('/(tabs)/feed');
    }, 'Drop Out');
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
    const { error: uploadError } = await supabase.storage.from('drop-off-photos').upload(path, blob, { upsert: true });
    if (uploadError) { Alert.alert('Upload Error', uploadError.message); setActionLoading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('drop-off-photos').getPublicUrl(path);
    await supabase.from('quests').update({ drop_off_photo_url: publicUrl }).eq('id', quest.id);
    if (posterProfile?.push_token) await sendPushNotification(posterProfile.push_token, 'Drop-Off Photo Submitted', 'Please confirm receipt.');
    setActionLoading(false);
  };

  const handleConfirmReceipt = async () => {
    if (!quest) return;
    setActionLoading(true);
    await supabase.from('quests').update({ status: 'completed' }).eq('id', quest.id);
    setQuest(prev => prev ? { ...prev, status: 'completed' } : prev);
    // Increment acceptor's quests_completed counter immediately
    if (quest.acceptor_id) {
      const { data: acc } = await supabase.from('profiles').select('quests_completed').eq('id', quest.acceptor_id).single();
      if (acc) await supabase.from('profiles').update({ quests_completed: (acc.quests_completed ?? 0) + 1 }).eq('id', quest.acceptor_id);
      await updateStreak(quest.acceptor_id);
    }
    if (acceptorProfile?.push_token) await sendPushNotification(acceptorProfile.push_token, 'Quest Completed!', `${quest.title} — please rate your experience.`);
    setActionLoading(false);
  };

  const handleMarkComplete = async () => {
    if (!quest) return;
    setActionLoading(true);
    await supabase.from('quests').update({ status: 'completed' }).eq('id', quest.id);
    setQuest(prev => prev ? { ...prev, status: 'completed' } : prev);
    // Increment acceptor's quests_completed counter immediately
    if (quest.acceptor_id) {
      const { data: acc } = await supabase.from('profiles').select('quests_completed').eq('id', quest.acceptor_id).single();
      if (acc) await supabase.from('profiles').update({ quests_completed: (acc.quests_completed ?? 0) + 1 }).eq('id', quest.acceptor_id);
      await updateStreak(quest.acceptor_id);
    }
    if (acceptorProfile?.push_token) await sendPushNotification(acceptorProfile.push_token, 'Quest Completed!', `${quest.title} — please rate your experience.`);
    setActionLoading(false);
  };

  const handleRating = async () => {
    if (!quest || !userId || selectedStars === 0) return;
    setActionLoading(true);
    const isPoster = userId === quest.poster_id;
    const rateeId = isPoster ? quest.acceptor_id! : quest.poster_id;
    await supabase.from('ratings').insert({ quest_id: quest.id, rater_id: userId, ratee_id: rateeId, stars: selectedStars });
    await supabase.rpc('update_avg_rating', { p_ratee_id: rateeId });
    await supabase.rpc('update_trust_tier', { user_id: rateeId });
    setRatingSubmitted(true);
    setActionLoading(false);
  };

  const handleNonPayment = () => {
    if (!quest || !userId) return;
    webConfirm('Report Non-Payment', 'This will issue a strike against the poster.', async () => {
      setActionLoading(true);
      await supabase.from('strikes').insert({ user_id: quest.poster_id, quest_id: quest.id, reason: 'non_payment' });
      const { data: p } = await supabase.from('profiles').select('strikes').eq('id', quest.poster_id).single();
      if (p) await supabase.from('profiles').update({ strikes: (p.strikes ?? 0) + 1 }).eq('id', quest.poster_id);
      setActionLoading(false);
      if (Platform.OS === 'web') window.alert('A strike has been issued against the poster.');
      else Alert.alert('Reported', 'A strike has been issued against the poster.');
    }, 'Report');
  };

  const handleSendMessage = async () => {
    const text = messageText.trim();
    if (!text || !userId || !quest) return;
    setMessageText('');
    // Optimistic: add immediately so the sender sees it right away
    const tempMsg = {
      id: `temp-${Date.now()}`,
      quest_id: quest.id,
      sender_id: userId,
      content: text,
      type: 'text',
      image_url: null,
      latitude: null,
      longitude: null,
      created_at: new Date().toISOString(),
    } as unknown as Message;
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 80);
    await supabase.from('messages').insert({ quest_id: quest.id, sender_id: userId, content: text, type: 'text' });
    const otherProfile = userId === quest.poster_id ? acceptorProfile : posterProfile;
    if (otherProfile?.push_token) await sendPushNotification(otherProfile.push_token, 'New Message', `${myProfile?.display_name ?? 'Someone'}: ${text}`);
  };

  const handleSendPhoto = async () => {
    if (!userId || !quest) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const path = `${quest.id}/${userId}_${Date.now()}.${ext}`;
    const blob = await (await fetch(asset.uri)).blob();
    const { error: uploadError } = await supabase.storage.from('chat-photos').upload(path, blob, { upsert: false });
    if (uploadError) { Alert.alert('Upload Error', uploadError.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('chat-photos').getPublicUrl(path);
    await supabase.from('messages').insert({ quest_id: quest.id, sender_id: userId, content: '', type: 'image', image_url: publicUrl });
    setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const handleSendLocation = async () => {
    if (!userId || !quest) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission denied', 'Location access is required.'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      await supabase.from('messages').insert({
        quest_id: quest.id, sender_id: userId,
        content: `${latitude.toFixed(5)},${longitude.toFixed(5)}`,
        type: 'location', latitude, longitude,
      });
    } catch {
      Alert.alert('Error', 'Could not get location. Make sure expo-location is installed.');
    }
  };

  const renderActionArea = () => {
    if (!quest || !userId) return null;
    const isPoster = userId === quest.poster_id;
    const isAcceptor = userId === quest.acceptor_id;
    const myTier = (myProfile?.trust_tier ?? 'wanderer') as TrustTier;

    const questType = (quest as any).quest_type as string | undefined;
    const maxAcc = (quest as any).max_acceptors as number ?? 1;
    const isCrew = questType === 'crew';
    const isSocial = questType === 'social';

    if (quest.status === 'open') {
      if (isPoster) {
        return (
          <View style={{ gap: 10 }}>
            <Card style={{ alignItems: 'center' }}>
              {isCrew
                ? <Text style={{ color: colors.textMuted, fontSize: 14 }}>{crewCount}/{maxAcc} crew members joined...</Text>
                : <Text style={{ color: colors.textMuted, fontSize: 14 }}>Waiting for someone to accept...</Text>
              }
            </Card>
            <Button variant="danger" size="md" loading={actionLoading} onPress={handleCancelQuest} style={{ width: '100%' }}>Cancel Quest</Button>
          </View>
        );
      }

      // Crew quest: join/leave crew
      if (isCrew) {
        if (isCrewMember) {
          return (
            <View style={{ gap: 10 }}>
              <Card style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <Users size={16} color="#60a5fa" strokeWidth={2} />
                <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '600' }}>You are in the crew ({crewCount}/{maxAcc})</Text>
              </Card>
              <Button variant="danger" size="md" loading={actionLoading} onPress={handleLeaveCrewQuest} style={{ width: '100%' }}>Leave Crew</Button>
            </View>
          );
        }
        const eligibility = canAccept(quest, myTier);
        return eligibility.ok ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>{crewCount}/{maxAcc} slots filled</Text>
            <Button variant="primary" size="lg" loading={actionLoading} onPress={handleJoinCrew} style={{ width: '100%' }}>Join Crew</Button>
          </View>
        ) : (
          <Card style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 14 }}>Cannot Join</Text>
            <Text style={{ color: colors.textFaint, fontSize: 13 }}>{eligibility.reason}</Text>
          </Card>
        );
      }

      const eligibility = canAccept(quest, myTier);
      return eligibility.ok ? (
        <Button variant="primary" size="lg" loading={actionLoading} onPress={handleAccept} style={{ width: '100%' }}>Accept Quest</Button>
      ) : (
        <Card style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 14 }}>Cannot Accept</Text>
          <Text style={{ color: colors.textFaint, fontSize: 13 }}>{eligibility.reason}</Text>
        </Card>
      );
    }

    if (quest.status === 'in_progress') {
      // Social quests: either poster or acceptor can mark complete
      if (isSocial && (isPoster || isAcceptor)) {
        return (
          <Button variant="primary" size="lg" loading={actionLoading} onPress={handleMarkComplete} style={{ width: '100%' }}>Mark Complete</Button>
        );
      }

      if (isAcceptor) {
        if (quest.fulfilment_mode === 'dropoff' && !quest.drop_off_photo_url) {
          return (
            <View style={{ gap: 10 }}>
              <Button variant="primary" size="lg" loading={actionLoading} onPress={handleSubmitPhoto} style={{ width: '100%' }}>Submit Drop-Off Photo</Button>
              <Button variant="danger" size="md" loading={actionLoading} onPress={handleDropOut} style={{ width: '100%' }}>Drop Out</Button>
            </View>
          );
        }
        if (quest.fulfilment_mode === 'dropoff') {
          return <Card style={{ alignItems: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 14 }}>Photo submitted — awaiting confirmation</Text></Card>;
        }
        return (
          <View style={{ gap: 10 }}>
            <Card style={{ alignItems: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 14 }}>Awaiting poster to mark complete</Text></Card>
            <Button variant="danger" size="md" onPress={handleDropOut} style={{ width: '100%' }}>Drop Out</Button>
          </View>
        );
      }
      if (isPoster) {
        if (quest.fulfilment_mode === 'meetup') {
          return <Button variant="primary" size="lg" loading={actionLoading} onPress={handleMarkComplete} style={{ width: '100%' }}>Mark Complete</Button>;
        }
        if (!quest.drop_off_photo_url) {
          return <Card style={{ alignItems: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 14 }}>Waiting for drop-off photo...</Text></Card>;
        }
        return (
          <View style={{ gap: 10 }}>
            <Image source={{ uri: quest.drop_off_photo_url }} style={{ width: '100%', height: 200, borderRadius: 16 }} resizeMode="cover" />
            <Button variant="primary" size="lg" loading={actionLoading} onPress={handleConfirmReceipt} style={{ width: '100%' }}>Confirm Receipt</Button>
          </View>
        );
      }
    }

    if (quest.status === 'completed') {
      const alreadyRated = ratingSubmitted || !!myRating;
      const canRate = (isPoster && !!quest.acceptor_id) || isAcceptor;

      if (alreadyRated || !canRate) {
        return (
          <View style={{ gap: 10 }}>
            <Card style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Quest Complete</Text>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13 }}>Thanks for using Ripple</Text>
            </Card>
            {isAcceptor && <Button variant="danger" size="sm" onPress={handleNonPayment} style={{ width: '100%' }}>Report Non-Payment</Button>}
          </View>
        );
      }

      return (
        <Card style={{ gap: 16 }}>
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16, textAlign: 'center', letterSpacing: -0.3 }}>
            Rate your experience
          </Text>
          <StarPicker value={selectedStars} onChange={setSelectedStars} />
          {selectedStars > 0 && (
            <Button variant="primary" size="lg" loading={actionLoading} onPress={handleRating} style={{ width: '100%' }}>Submit Rating</Button>
          )}
          {!isSocial && (
            <Text style={{ color: colors.textFaint, fontSize: 12, textAlign: 'center' }}>
              Remember to settle payment via PayNow or cash.
            </Text>
          )}
          {isAcceptor && <Button variant="danger" size="sm" onPress={handleNonPayment} style={{ width: '100%' }}>Report Non-Payment</Button>}
        </Card>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.textFaint} />
      </View>
    );
  }

  if (!quest) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 16 }}>Quest not found</Text>
        <Button variant="secondary" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/feed')}>Go back</Button>
      </View>
    );
  }

  const deadlineDate = new Date(quest.deadline);
  const timeLeft = isPast(deadlineDate) ? 'Expired' : `${formatDistanceToNow(deadlineDate)} left`;
  const showChat = quest.status === 'in_progress' || quest.status === 'completed';

  const renderMessageBubble = (msg: Message) => {
    const isMe = msg.sender_id === userId;
    const senderProfile = msg.sender_id === quest.poster_id ? posterProfile : acceptorProfile;
    return (
      <View key={msg.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
        {!isMe && senderProfile && (
          <Text style={{ color: colors.textFaint, fontSize: 11, marginBottom: 3, marginLeft: 4 }}>
            {senderProfile.display_name}
          </Text>
        )}
        <View style={{
          maxWidth: '80%',
          backgroundColor: isMe ? 'rgba(124,58,237,0.70)' : colors.surface2,
          borderRadius: 18,
          borderBottomRightRadius: isMe ? 4 : 18,
          borderBottomLeftRadius: isMe ? 18 : 4,
          overflow: 'hidden',
        }}>
          {(msg as any).type === 'image' && (msg as any).image_url ? (
            <Image source={{ uri: (msg as any).image_url }} style={{ width: 200, height: 150 }} resizeMode="cover" />
          ) : (msg as any).type === 'location' && (msg as any).latitude ? (
            <Pressable
              style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${(msg as any).latitude},${(msg as any).longitude}`)}
            >
              <Navigation size={16} color="#ffffff" strokeWidth={2} />
              <Text style={{ color: '#ffffff', fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' }}>View Location</Text>
            </Pressable>
          ) : (
            <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: '#ffffff', fontSize: 14, lineHeight: 20 }}>{msg.content}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        backAction
        title={quest.ai_generated_title ?? quest.title}
        rightAction={<Badge variant="status" value={quest.status} />}
      />

      {/* Tab switcher — only visible once quest is active */}
      {showChat && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
          <Chip label="Details" selected={activeView === 'details'} onPress={() => setActiveView('details')} />
          <Chip
            label={`Chat${messages.length > 0 ? ` (${messages.length})` : ''}`}
            selected={activeView === 'chat'}
            onPress={() => {
              setActiveView('chat');
              setTimeout(() => chatListRef.current?.scrollToEnd({ animated: false }), 100);
            }}
          />
        </View>
      )}

      {/* ── Details tab ─────────────────────────────────────────────── */}
      {(!showChat || activeView === 'details') && (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tags row */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <Badge variant="tag" value={quest.tag} />
            <Badge variant="mode" value={quest.fulfilment_mode} />
            {quest.is_flash && <Badge variant="default" value="Flash" />}
          </View>

          {/* Title */}
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.6, lineHeight: 30, marginBottom: 10 }}>
            {quest.ai_generated_title ?? quest.title}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 23, marginBottom: 20 }}>
            {quest.description}
          </Text>

          {/* Info strip */}
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {[
                { icon: DollarSign, label: 'Reward', value: quest.reward_amount > 0 ? `$${quest.reward_amount.toFixed(2)}` : 'Favour', color: '#a78bfa' },
                { icon: Clock, label: 'Deadline', value: timeLeft, color: colors.text },
                ...(quest.location_name ? [{ icon: MapPin, label: 'Location', value: quest.location_name, color: colors.text }] : []),
              ].map((item, i, arr) => (
                <View key={item.label} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: colors.border }}>
                  <item.icon size={14} color={colors.textFaint} strokeWidth={2} style={{ marginBottom: 6 }} />
                  <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 }}>
                    {item.label.toUpperCase()}
                  </Text>
                  <Text style={{ color: item.color, fontWeight: '700', fontSize: 13, letterSpacing: -0.2, textAlign: 'center' }} numberOfLines={2}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          {posterProfile && <View style={{ marginBottom: 10 }}><ProfileCard label="Posted by" profile={posterProfile} /></View>}
          {acceptorProfile && <View style={{ marginBottom: 16 }}><ProfileCard label="Accepted by" profile={acceptorProfile} /></View>}

          {/* Action area */}
          <View style={{ marginBottom: 24 }}>
            {renderActionArea()}
          </View>

          {/* Prompt to open chat if active */}
          {showChat && (
            <Pressable
              onPress={() => {
                setActiveView('chat');
                setTimeout(() => chatListRef.current?.scrollToEnd({ animated: false }), 100);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: colors.surface2,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                paddingVertical: 14,
              }}
            >
              <MessageCircle size={17} color={colors.textMuted} strokeWidth={2} />
              <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '500' }}>
                {messages.length > 0 ? `${messages.length} messages — tap to chat` : 'Open chat'}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* ── Chat tab ────────────────────────────────────────────────── */}
      {showChat && activeView === 'chat' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <FlatList
            ref={chatListRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={({ item }) => renderMessageBubble(item)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <MessageCircle size={40} color={colors.textFaint} strokeWidth={1.5} />
                <Text style={{ color: colors.textFaint, fontSize: 14, marginTop: 12 }}>No messages yet. Say hello!</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />

          {/* Input bar */}
          <GlassView style={{ paddingHorizontal: 12, paddingVertical: 10, paddingBottom: insets.bottom + 10, flexDirection: 'row', gap: 8, alignItems: 'center' }} borderRadius={0}>
            <Pressable
              onPress={handleSendPhoto}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
            >
              <Camera size={17} color={colors.textMuted} strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={handleSendLocation}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
            >
              <Navigation size={17} color={colors.textMuted} strokeWidth={2} />
            </Pressable>
            <View style={{ flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 }}>
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Message..."
                placeholderTextColor={colors.inputPlaceholder}
                style={{ color: colors.inputText, fontSize: 15, padding: 0, margin: 0 }}
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
              />
            </View>
            <Pressable
              onPress={handleSendMessage}
              disabled={!messageText.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                backgroundColor: messageText.trim() ? '#7c3aed' : colors.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={17} color={messageText.trim() ? '#ffffff' : colors.textFaint} strokeWidth={2} />
            </Pressable>
          </GlassView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
