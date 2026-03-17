import {
  View,
  Text,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router'; // Added useLocalSearchParams
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { encodeGeohash } from '@/lib/geohash';
import { QUEST_TAGS, TAG_COLOURS } from '@/constants';
import { useTheme } from '@/lib/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { Users, Package, Send, Zap, MapPin, CheckCircle2 } from 'lucide-react-native'; // Added icons
import type { QuestTag, FulfilmentMode } from '@/types/database';

// NUS UTown rough centre
const UTOWN_LAT = 1.3063;
const UTOWN_LNG = 103.7733;

const STEPS = ['Details', 'Location', 'Reward'] as const;
type Step = (typeof STEPS)[number];

const DEADLINE_LABELS = ['1 hour', '3 hours', 'Tonight (10 PM)', 'Tomorrow noon'] as const;
type DeadlineLabel = (typeof DEADLINE_LABELS)[number];

const RC_LOCATIONS = [
  'Tembusu College', 'CAPT', 'RC4', 'RVRC', 'Acacia', 'NUSC', 'UTR',
  'Stephen Riady Centre',
];

function buildDeadlineFromLabel(label: DeadlineLabel): Date {
  switch (label) {
    case '1 hour':      return new Date(Date.now() + 1 * 3600 * 1000);
    case '3 hours':     return new Date(Date.now() + 3 * 3600 * 1000);
    case 'Tonight (10 PM)': return todayAt(22);
    case 'Tomorrow noon':   return tomorrowAt(12);
  }
}

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };

interface QuestFields {
  title: string | null;
  description: string | null;
  tag: QuestTag | null;
  fulfilment_mode: 'meetup' | 'dropoff' | null;
  reward_amount: number | null;
  deadline_label: DeadlineLabel | null;
  location_name: string | null;
}

let _msgId = 0;
function nextId() { return String(++_msgId); }

const GREETING = "What quest would you like to post? Describe it in plain English — I'll handle the rest.";

// ─── Typing Dots ─────────────────────────────────────────────────────────────
const DOT_BASE = { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.60)' } as const;

function TypingDots() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const anim = (sv: ReturnType<typeof useSharedValue<number>>) => {
      sv.value = withRepeat(
        withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 300 })),
        -1, false,
      );
    };
    anim(dot1);
    setTimeout(() => anim(dot2), 150);
    setTimeout(() => anim(dot3), 300);
  }, []);

  const style1 = useAnimatedStyle(() => ({
    opacity: interpolate(dot1.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot1.value, [0, 1], [0, -4]) }],
  }));
  const style2 = useAnimatedStyle(() => ({
    opacity: interpolate(dot2.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot2.value, [0, 1], [0, -4]) }],
  }));
  const style3 = useAnimatedStyle(() => ({
    opacity: interpolate(dot3.value, [0, 1], [0.3, 1]),
    transform: [{ translateY: interpolate(dot3.value, [0, 1], [0, -4]) }],
  }));

  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 4 }}>
      <Animated.View style={[DOT_BASE, style1]} />
      <Animated.View style={[DOT_BASE, style2]} />
      <Animated.View style={[DOT_BASE, style3]} />
    </View>
  );
}

// ─── Mode Toggle ─────────────────────────────────────────────────────────────
function ModeToggle({ value, onChange }: { value: 'ai' | 'manual'; onChange: (m: 'ai' | 'manual') => void }) {
  const slideX = useSharedValue(value === 'ai' ? 0 : 1);
  useEffect(() => {
    slideX.value = withSpring(value === 'ai' ? 0 : 1, { damping: 20, stiffness: 200 });
  }, [value]);
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(slideX.value, [0, 1], [0, 96]) }],
  }));
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 999,
      padding: 4,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
      alignSelf: 'flex-start',
      position: 'relative',
      width: 200,
    }}>
      <Animated.View style={[{
        position: 'absolute', top: 4, left: 4, width: 96, bottom: 4, backgroundColor: '#ffffff', borderRadius: 999,
      }, pillStyle]} />
      {(['ai', 'manual'] as const).map((m) => (
        <Pressable key={m} onPress={() => onChange(m)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, zIndex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: value === m ? '#000000' : 'rgba(255,255,255,0.50)' }}>
            {m === 'ai' ? 'AI' : 'Manual'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PostQuest() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams(); // To catch picked coordinates
  const [postMode, setPostMode] = useState<'ai' | 'manual'>('ai');

  // AI chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ id: nextId(), role: 'assistant', content: GREETING }]);
  const [collectedFields, setCollectedFields] = useState<Partial<QuestFields>>({});
  const [chatLoading, setChatLoading] = useState(false);
  const [questReady, setQuestReady] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [pendingReply, setPendingReply] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [animatingText, setAnimatingText] = useState('');
  const [animatingDone, setAnimatingDone] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<QuestTag | ''>('');
  const [mode, setMode] = useState<FulfilmentMode>('meetup');
  const [reward, setReward] = useState('');
  const [deadlineLabel, setDeadlineLabel] = useState<DeadlineLabel | ''>('');
  const [locationName, setLocationName] = useState('UTown, NUS');
  const [latitude, setLatitude] = useState<number | null>(null); // NEW
  const [longitude, setLongitude] = useState<number | null>(null); // NEW
  const [isFlash, setIsFlash] = useState(false);
  const [questType, setQuestType] = useState<'standard' | 'social' | 'crew'>('standard');
  const [maxAcceptors, setMaxAcceptors] = useState(2);
  const [step, setStep] = useState<Step>('Details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { colors } = useTheme();
  const stepIndex = STEPS.indexOf(step);

  // Handle coordinates coming back from Map
  useEffect(() => {
    if (params.lat && params.lon) {
      setLatitude(Number(params.lat));
      setLongitude(Number(params.lon));
      setStep('Location'); // Force return to Location step so they see it worked
    }
  }, [params.lat, params.lon]);

  useEffect(() => {
    if (!pendingReply) return;
    setAnimatingDone(false); setAnimatingText('');
    let i = 0;
    const interval = setInterval(() => {
      i++; setAnimatingText(pendingReply.slice(0, i));
      if (i >= pendingReply.length) {
        clearInterval(interval); setAnimatingDone(true);
        setChatMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: pendingReply! }]);
        setPendingReply(null); if (pendingComplete) setQuestReady(true);
      }
    }, 12);
    return () => clearInterval(interval);
  }, [pendingReply]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatMessages, animatingText, chatLoading]);

  function resetForm() {
    setTitle(''); setDescription(''); setTag(''); setMode('meetup');
    setReward(''); setDeadlineLabel(''); setLocationName('UTown, NUS');
    setLatitude(null); setLongitude(null);
    setIsFlash(false); setQuestType('standard'); setMaxAcceptors(2);
    setStep('Details'); setError('');
  }

  function handleModeSwitch(m: 'ai' | 'manual') { setPostMode(m); resetForm(); }

  // Manual: Submit
  async function handleSubmit() {
    if (!title.trim()) { setError('Quest title is required.'); return; }
    if (!description.trim() || description.length < 20) { setError('Description must be at least 20 chars.'); return; }
    if (!deadlineLabel) { setError('Select a deadline.'); return; }
    
    const deadlineDate = buildDeadlineFromLabel(deadlineLabel as DeadlineLabel);
    setLoading(true); setError('');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in.'); return; }
      
      const flashExpiresAt = isFlash ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;
      
      const { data: quest, error: insertError } = await supabase
        .from('quests')
        .insert({
          poster_id: user.id,
          title: title.trim(), description: description.trim(),
          tag: (tag || 'errands') as QuestTag, fulfilment_mode: mode,
          reward_amount: questType === 'social' ? 0 : (parseFloat(reward) || 0),
          deadline: deadlineDate.toISOString(),
          location_name: locationName || 'UTown, NUS',
          latitude: latitude || UTOWN_LAT, // Use picked lat
          longitude: longitude || UTOWN_LNG, // Use picked lon
          geohash: encodeGeohash(latitude || UTOWN_LAT, longitude || UTOWN_LNG),
          status: 'open', is_flash: isFlash, flash_expires_at: flashExpiresAt,
          quest_type: questType,
          max_acceptors: questType === 'crew' ? maxAcceptors : 1,
        })
        .select('id').single();

      if (insertError) { setError(insertError.message); return; }
      
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Manual Mode: Details ──────────────────────────────────────────────────
  if (step === 'Details') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader title="Post a Quest" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}>
          <View style={{ marginBottom: 20 }}>
            <ModeToggle value={postMode} onChange={handleModeSwitch} />
          </View>
          <StepIndicator steps={[...STEPS]} currentIndex={stepIndex} />
          
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 20 }}>What do you need?</Text>
          <Input label="Quest Title" placeholder="e.g. Help with grocery pickup" value={title} onChangeText={setTitle} />
          <View style={{height: 12}} />
          <Input label="Description" placeholder="Provide more details..." value={description} onChangeText={setDescription} multiline numberOfLines={4} style={{ minHeight: 100 }} />
          
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 20 }}>CATEGORY</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
            {QUEST_TAGS.map((t) => (
              <Chip key={t} label={t} selected={tag === t} onPress={() => setTag(t)} color={(TAG_COLOURS as any)[t]} />
            ))}
          </View>

          <Button variant="primary" size="lg" onPress={() => setStep('Location')} style={{ marginTop: 20 }}>Next</Button>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Manual Mode: Location (MAP PICKER ADDED) ──────────────────────────────
  if (step === 'Location') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Location" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}>
          <StepIndicator steps={[...STEPS]} currentIndex={stepIndex} />
          
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 20 }}>Where?</Text>
          
          {/* MAP PICKER BUTTON */}
          <TouchableOpacity 
            onPress={() => router.push({ pathname: '/(tabs)/map', params: { mode: 'pick' } })}
            style={{
              backgroundColor: 'rgba(124,58,237,0.1)',
              borderWidth: 1,
              borderColor: latitude ? '#10b981' : '#7c3aed',
              borderRadius: 16,
              padding: 24,
              alignItems: 'center',
              marginVertical: 24,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 12
            }}
          >
            {latitude ? <CheckCircle2 size={24} color="#10b981" /> : <MapPin size={24} color="#a78bfa" />}
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              {latitude ? "Location Set on Map" : "Pin Location on Map"}
            </Text>
          </TouchableOpacity>

          <Input label="Location Name" placeholder="e.g. Level 2 Lounge" value={locationName} onChangeText={setLocationName} />
          
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 40 }}>
            <Button variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => setStep('Details')}>Back</Button>
            <Button variant="primary" size="lg" style={{ flex: 1 }} onPress={() => setStep('Reward')}>Next</Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Manual Mode: Reward ───────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Reward" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}>
        <StepIndicator steps={[...STEPS]} currentIndex={stepIndex} />
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 20 }}>Reward & Deadline</Text>
        
        <Input label="Cash Reward ($)" placeholder="3.50" keyboardType="decimal-pad" value={reward} onChangeText={setReward} />
        
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 20 }}>DEADLINE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
          {DEADLINE_LABELS.map((l) => (
            <Chip key={l} label={l} selected={deadlineLabel === l} onPress={() => setDeadlineLabel(l)} />
          ))}
        </View>

        <Button variant="primary" size="lg" loading={loading} onPress={handleSubmit} style={{ marginTop: 40 }}>Post Quest</Button>
        <Button variant="secondary" size="lg" onPress={() => setStep('Location')} style={{ marginTop: 12 }}>Back</Button>
      </ScrollView>
    </View>
  );
}

function todayAt(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
}

function tomorrowAt(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}