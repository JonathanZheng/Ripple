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
  StyleSheet,
  TouchableOpacity,
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

// --- INTERNAL LOCATION PREVIEW ---
import { Map, Marker as WebMarker } from 'pigeon-maps';
import * as Location from 'expo-location';

function MiniLocationPreview({ lat, lon }: { lat: number; lon: number }) {
  return (
    <View style={styles.miniMapWrapper}>
      <Map 
        center={[lat, lon]} 
        zoom={15} 
        mouseEvents={false} 
        touchEvents={false}
        boxClassname="map-dark-mode"
      >
        <WebMarker anchor={[lat, lon]} width={30}>
          <MapPin size={20} color="#ef4444" fill="#ef4444" />
        </WebMarker>
      </Map>
      <View style={StyleSheet.absoluteFill} /> 
    </View>
  );
}

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
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>{profile.display_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12 }}>{profile.rc}</Text>
            <Text style={{ color: tierConfig.colour, fontSize: 12, fontWeight: '600' }}>{tierConfig.label}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={13} color={s <= fullStars ? '#fbbf24' : 'rgba(255,255,255,0.15)'} fill={s <= fullStars ? '#fbbf24' : 'transparent'} />
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
      {[1,2,3,4,5].map(star => (
        <Pressable key={star} onPress={() => onChange(star)}>
          <Star size={36} color={star <= value ? '#fbbf24' : 'rgba(255,255,255,0.18)'} fill={star <= value ? '#fbbf24' : 'transparent'} />
        </Pressable>
      ))}
    </View>
  );
}

export default function QuestDetail() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { session } = useSession();
  const userId = session?.user?.id;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

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

  const chatListRef = useRef<FlatList>(null);
  const scrollRef = useRef<ScrollView>(null);

  const fetchData = useCallback(async () => {
    if (!id || !userId) return;
    
    try {
      const [questRes, myProfileRes] = await Promise.all([
        supabase.from('quests').select('*').eq('id', id).single(),
        supabase.from('profiles').select('*').eq('id', userId).single(),
      ]);

      if (questRes.data) {
        const q = questRes.data as Quest;
        setQuest(q);

        // Fetch related data
        const pRes = await supabase.from('profiles').select('*').eq('id', q.poster_id).single();
        const mRes = await supabase.from('messages').select('*').eq('quest_id', id).order('created_at', { ascending: true });
        const rRes = await supabase.from('ratings').select('*').eq('quest_id', id).eq('rater_id', userId).maybeSingle();
        const cRes = await supabase.from('crew_members').select('*').eq('quest_id', id).eq('status', 'active');

        if (pRes.data) setPosterProfile(pRes.data as Profile);
        if (mRes.data) setMessages(mRes.data as Message[]);
        if (rRes.data) setMyRating(rRes.data as Rating);
        if (cRes.data) {
          setCrewCount(cRes.data.length);
          setIsCrewMember(cRes.data.some((m: any) => m.user_id === userId));
        }

        if (q.acceptor_id) {
          const aRes = await supabase.from('profiles').select('*').eq('id', q.acceptor_id).single();
          if (aRes.data) setAcceptorProfile(aRes.data as Profile);
        }
      }
      if (myProfileRes.data) setMyProfile(myProfileRes.data as Profile);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`quest-chat-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quests', filter: `id=eq.${id}` }, (payload) => setQuest(payload.new as Quest))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `quest_id=eq.${id}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const handleAccept = async () => {
    if (!quest || !userId) return;
    setActionLoading(true);
    await supabase.from('quests').update({ status: 'in_progress', acceptor_id: userId }).eq('id', quest.id).eq('status', 'open');
    await fetchData();
    setActionLoading(false);
  };

  const handleJoinCrew = async () => {
    if (!quest || !userId) return;
    setActionLoading(true);
    await supabase.from('crew_members').insert({ quest_id: quest.id, user_id: userId });
    await fetchData();
    setActionLoading(false);
  };

  const handleLeaveCrewQuest = () => {
    if (!quest || !userId) return;
    webConfirm('Leave Crew', 'Leave this crew?', async () => {
      setActionLoading(true);
      await supabase.from('crew_members').update({ status: 'dropped_out' }).eq('quest_id', quest.id).eq('user_id', userId);
      await fetchData();
      setActionLoading(false);
    });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !userId || !id) return;
    const text = messageText.trim();
    setMessageText('');
    await supabase.from('messages').insert({ quest_id: id, sender_id: userId, content: text, type: 'text' });
  };

  const handleSendPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const path = `${id}/${userId}_${Date.now()}.${ext}`;
    const blob = await (await fetch(asset.uri)).blob();
    await supabase.storage.from('chat-photos').upload(path, blob);
    const { data: { publicUrl } } = supabase.storage.from('chat-photos').getPublicUrl(path);
    await supabase.from('messages').insert({ quest_id: id, sender_id: userId, type: 'image', image_url: publicUrl, content: '' });
  };

  const handleSendLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    await supabase.from('messages').insert({
      quest_id: id, sender_id: userId, type: 'location',
      content: `LOCATION_DATA:${loc.coords.latitude},${loc.coords.longitude}`,
      latitude: loc.coords.latitude, longitude: loc.coords.longitude
    });
  };

  const handleConfirmReceipt = async () => {
    if (!quest) return;
    setActionLoading(true);
    await supabase.from('quests').update({ status: 'completed' }).eq('id', quest.id);
    if (quest.acceptor_id) {
        const { data: acc } = await supabase.from('profiles').select('quests_completed').eq('id', quest.acceptor_id).single();
        if (acc) {
          await supabase.from('profiles').update({ quests_completed: (acc.quests_completed ?? 0) + 1 }).eq('id', quest.acceptor_id);
          await updateStreak(quest.acceptor_id);
        }
    }
    await fetchData();
    setActionLoading(false);
  };

  const handleMarkComplete = async () => {
    await handleConfirmReceipt();
  };

  const handleRating = async () => {
    if (!quest || !userId || selectedStars === 0) return;
    setActionLoading(true);
    const rateeId = userId === quest.poster_id ? quest.acceptor_id! : quest.poster_id;
    await supabase.from('ratings').insert({ quest_id: quest.id, rater_id: userId, ratee_id: rateeId, stars: selectedStars });
    await (supabase.rpc as any)('update_avg_rating', { p_ratee_id: rateeId });
    setRatingSubmitted(true);
    setActionLoading(false);
  };

  const deadlineDate = quest ? new Date(quest.deadline) : new Date();
  const timeLeft = quest ? (isPast(deadlineDate) ? 'Expired' : `${formatDistanceToNow(deadlineDate)} left`) : '';

  const renderMessageBubble = (msg: Message) => {
    const isMe = msg.sender_id === userId;
    const isLoc = msg.content.startsWith('LOCATION_DATA:');
    return (
      <View key={msg.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, isLoc && styles.locBubble]}>
          {isLoc ? (
            <TouchableOpacity onPress={() => {
              const coords = msg.content.split(':')[1].split(',');
              router.push({ pathname: '/(tabs)/map', params: { lat: coords[0], lon: coords[1] } });
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <MapPin size={14} color="#fff" /><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Shared Location</Text>
              </View>
              <MiniLocationPreview lat={Number((msg as any).latitude)} lon={Number((msg as any).longitude)} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                <Navigation size={12} color="#fff" /><Text style={{ color: '#fff', fontSize: 11 }}>View on Ripple Map</Text>
              </View>
            </TouchableOpacity>
          ) : (msg as any).type === 'image' && (msg as any).image_url ? (
            <Image source={{ uri: (msg as any).image_url }} style={{ width: 200, height: 150, borderRadius: 12 }} />
          ) : (
            <Text style={{ color: '#fff' }}>{msg.content}</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  if (!quest) return <View style={styles.center}><Text style={{color:'#fff'}}>Quest not found</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader backAction title={quest.ai_generated_title ?? quest.title} rightAction={<Badge variant="status" value={quest.status} />} />
      
      {(quest.status === 'in_progress' || quest.status === 'completed') && (
        <View style={{ flexDirection: 'row', padding: 16, gap: 8 }}>
            <Chip label="Details" selected={activeView === 'details'} onPress={() => setActiveView('details')} />
            <Chip label="Chat" selected={activeView === 'chat'} onPress={() => setActiveView('chat')} />
        </View>
      )}

      {activeView === 'details' ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                <Badge variant="tag" value={quest.tag} /><Badge variant="mode" value={quest.fulfilment_mode} />
                {quest.is_flash && <Badge variant="default" value="Flash" />}
            </View>
            <Text style={styles.title}>{quest.ai_generated_title ?? quest.title}</Text>
            <Text style={styles.desc}>{quest.description}</Text>
            <Card style={{marginVertical: 20}}>
                <View style={{flexDirection:'row', justifyContent:'space-around'}}>
                    <View style={styles.metaBox}><DollarSign size={14} color="#a78bfa"/><Text style={styles.metaVal}>${quest.reward_amount}</Text></View>
                    <View style={styles.metaBox}><Clock size={14} color="#fff"/><Text style={styles.metaVal}>{timeLeft}</Text></View>
                    <View style={styles.metaBox}><MapPin size={14} color="#fff"/><Text style={styles.metaVal}>{quest.location_name}</Text></View>
                </View>
            </Card>
            {posterProfile && <ProfileCard label="Poster" profile={posterProfile} />}
            {acceptorProfile && <View style={{marginTop: 10}}><ProfileCard label="Accepted By" profile={acceptorProfile} /></View>}

            <View style={{marginTop: 24}}>
                {quest.status === 'open' && userId !== quest.poster_id && <Button variant="primary" size="lg" onPress={handleAccept}>Accept Quest</Button>}
                {quest.status === 'in_progress' && userId === quest.poster_id && <Button variant="primary" size="lg" onPress={handleConfirmReceipt}>Confirm Completion</Button>}
                {quest.status === 'completed' && !ratingSubmitted && (
                    <Card style={{gap: 15}}>
                        <Text style={{color:'#fff', textAlign:'center', fontWeight:'700'}}>Rate Experience</Text>
                        <StarPicker value={selectedStars} onChange={setSelectedStars} />
                        <Button variant="primary" onPress={handleRating} disabled={selectedStars === 0}>Submit Rating</Button>
                    </Card>
                )}
            </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
            <FlatList ref={chatListRef} data={messages} keyExtractor={m => m.id} renderItem={({ item }) => renderMessageBubble(item)} onContentSizeChange={() => chatListRef.current?.scrollToEnd()} contentContainerStyle={{ padding: 16 }} />
            <GlassView style={StyleSheet.flatten([styles.inputBar, { paddingBottom: insets.bottom + 10 }])} borderRadius={0}>
                <TouchableOpacity onPress={handleSendPhoto} style={styles.iconBtn}><Camera size={18} color="#fff" /></TouchableOpacity>
                <TouchableOpacity onPress={handleSendLocation} style={styles.iconBtn}><Navigation size={18} color="#fff" /></TouchableOpacity>
                <View style={styles.inputWrapper}>
                    <TextInput value={messageText} onChangeText={setMessageText} placeholder="Message..." placeholderTextColor="#444" style={styles.input} />
                </View>
                <TouchableOpacity onPress={handleSendMessage} style={styles.sendBtn}><Send size={18} color="#fff" /></TouchableOpacity>
            </GlassView>
        </KeyboardAvoidingView>
      )}

      <style>{`.map-dark-mode { filter: invert(90%) hue-rotate(180deg) brightness(95%); }`}</style>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 10 },
  desc: { color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 22 },
  metaBox: { alignItems: 'center', gap: 4, flex: 1 },
  metaVal: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  bubble: { padding: 12, borderRadius: 18, maxWidth: '85%' },
  bubbleMe: { backgroundColor: '#7c3aed', borderBottomRightRadius: 4, alignSelf: 'flex-end' },
  bubbleThem: { backgroundColor: '#1c1c1e', borderBottomLeftRadius: 4, alignSelf: 'flex-start' },
  locBubble: { padding: 8, width: 240, backgroundColor: '#1c1c1e', borderWidth: 1, borderColor: '#333' },
  miniMapWrapper: { width: '100%', height: 140, borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  inputWrapper: { flex: 1, backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  input: { color: '#fff', fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' }
});