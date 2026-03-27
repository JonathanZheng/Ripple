import {
  View,
  Text,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { encodeGeohash } from '@/lib/geohash';
import { QUEST_TAGS, TAG_COLOURS, NUS_LOCATIONS, STRIKE_THRESHOLDS } from '@/constants';
import { useSession } from '@/hooks/useSession';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/lib/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { Users, Package, Send, Zap, MapPin, X, Search } from 'lucide-react-native';
import type { QuestTag, FulfilmentMode } from '@/types/database';

// ─── Price Suggestion ─────────────────────────────────────────────────────────

function suggestPrice(tag: QuestTag | ''): { min: number; max: number; label: string } | null {
  switch (tag) {
    case 'food':      return { min: 1, max: 3, label: 'Quick errand' };
    case 'transport': return { min: 1, max: 3, label: 'Getting around' };
    case 'skills':    return { min: 1, max: 3, label: 'Skills take time' };
    case 'errands':   return { min: 1, max: 3, label: 'General help' };
    case 'social':    return { min: 0, max: 0, label: 'No payment for social' };
    default:          return null;
  }
}

// NUS UTown rough centre
const UTOWN_LAT = 1.3063;
const UTOWN_LNG = 103.7733;

const STEPS = ['Details', 'Location', 'Reward'] as const;
type Step = (typeof STEPS)[number];

const DEADLINE_LABELS = ['1 hour', '3 hours', 'Tonight (10 PM)', 'Tomorrow noon'] as const;
type DeadlineLabel = (typeof DEADLINE_LABELS)[number];


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
const TOGGLE_ANIM = { duration: 220, easing: Easing.out(Easing.cubic) };
const PILL_W = 96;

function ToggleLabel({ label, isActive }: { label: string; isActive: boolean }) {
  const style = useAnimatedStyle(() => ({
    color: withTiming(isActive ? '#000000' : 'rgba(255,255,255,0.50)', TOGGLE_ANIM),
  }));
  return (
    <Animated.Text style={[{ fontSize: 13, fontWeight: '600' }, style]}>
      {label}
    </Animated.Text>
  );
}

function ModeToggle({ value, onChange }: { value: 'ai' | 'manual'; onChange: (m: 'ai' | 'manual') => void }) {
  const progress = useSharedValue(value === 'manual' ? 0 : 1);

  useEffect(() => {
    progress.value = withTiming(value === 'manual' ? 0 : 1, TOGGLE_ANIM);
  }, [value]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, PILL_W]) }],
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
      width: PILL_W * 2 + 8,
    }}>
      <Animated.View style={[{
        position: 'absolute',
        top: 4, left: 4, bottom: 4,
        width: PILL_W,
        backgroundColor: '#ffffff',
        borderRadius: 999,
      }, pillStyle]} />
      {(['manual', 'ai'] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => onChange(m)}
          style={{ width: PILL_W, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, zIndex: 1 }}
        >
          <ToggleLabel label={m === 'ai' ? 'AI' : 'Manual'} isActive={value === m} />
        </Pressable>
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PostQuest() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { profile } = useProfile(session?.user.id);
  const [postMode, setPostMode] = useState<'ai' | 'manual'>('manual');

  // ── AI chat state ──────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: nextId(), role: 'assistant', content: GREETING },
  ]);
  const [collectedFields, setCollectedFields] = useState<Partial<QuestFields>>({});
  const [chatLoading, setChatLoading] = useState(false);
  const [questReady, setQuestReady] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [pendingReply, setPendingReply] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [animatingText, setAnimatingText] = useState('');
  const [animatingDone, setAnimatingDone] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  const shouldReset = useRef(false);

  useFocusEffect(useCallback(() => {
    if (profile && profile.strikes >= STRIKE_THRESHOLDS.suspend) {
      Alert.alert(
        'Posting Suspended',
        `You have ${profile.strikes} strike${profile.strikes !== 1 ? 's' : ''}. Quest posting is suspended pending review. Contact your RC admin or Ripple support if you believe this is an error.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/feed') }],
      );
    }
  }, [profile]));

  useFocusEffect(useCallback(() => {
    if (!shouldReset.current) return;
    shouldReset.current = false;
    setTitle(''); setDescription(''); setTag(''); setMode('meetup');
    setReward(''); setDeadlineLabel(''); setLocationName('');
    setPreciseLocation(''); setLocationSearch('');
    setPickedLat(null); setPickedLon(null);
    setIsFlash(false); setQuestType('standard'); setMaxAcceptors(2);
    setStep('Details'); setError('');
    setChatMessages([{ id: nextId(), role: 'assistant', content: GREETING }]);
    setCollectedFields({}); setChatLoading(false); setQuestReady(false);
    setChatInput(''); setPendingReply(null); setPendingComplete(false);
    setAnimatingText(''); setAnimatingDone(true);
  }, []));

  // ── Shared form state ──────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<QuestTag | ''>('');
  const [mode, setMode] = useState<FulfilmentMode>('meetup');
  const [reward, setReward] = useState('');
  const [deadlineLabel, setDeadlineLabel] = useState<DeadlineLabel | ''>('');
  const [locationName, setLocationName] = useState('');
  const [preciseLocation, setPreciseLocation] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLon, setPickedLon] = useState<number | null>(null);
  const [isFlash, setIsFlash] = useState(false);

  const [questType, setQuestType] = useState<'standard' | 'social' | 'crew'>('standard');
  const [maxAcceptors, setMaxAcceptors] = useState(2);

  const [step, setStep] = useState<Step>('Details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { colors } = useTheme();

  const stepIndex = STEPS.indexOf(step);

  // ── Typing animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingReply) return;
    setAnimatingDone(false);
    setAnimatingText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setAnimatingText(pendingReply.slice(0, i));
      if (i >= pendingReply.length) {
        clearInterval(interval);
        setAnimatingDone(true);
        setChatMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: pendingReply! }]);
        setPendingReply(null);
        if (pendingComplete) setQuestReady(true);
      }
    }, 12);
    return () => clearInterval(interval);
  }, [pendingReply]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatMessages, animatingText, chatLoading]);

  function resetForm() {
    setTitle(''); setDescription(''); setTag(''); setMode('meetup');
    setReward(''); setDeadlineLabel(''); setLocationName('');
    setPreciseLocation(''); setLocationSearch('');
    setPickedLat(null); setPickedLon(null);
    setIsFlash(false); setQuestType('standard'); setMaxAcceptors(2);
    setStep('Details'); setError('');
  }

  function resetAiChat() {
    setChatMessages([{ id: nextId(), role: 'assistant', content: GREETING }]);
    setCollectedFields({}); setChatLoading(false); setQuestReady(false);
    setChatInput(''); setPendingReply(null); setPendingComplete(false);
    setAnimatingText(''); setAnimatingDone(true);
  }

  function handleModeSwitch(m: 'ai' | 'manual') {
    setPostMode(m); resetAiChat(); resetForm(); setError('');
  }

  // ─── AI: Send message ──────────────────────────────────────────────────────
  async function handleSendMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading || !animatingDone) return;
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    setError('');
    try {
      const historyForApi = [...chatMessages, userMsg].map(({ role, content }) => ({ role, content }));
      const { data, error: fnError } = await supabase.functions.invoke('chat-quest', {
        body: { messages: historyForApi, collected_fields: collectedFields, current_time: new Date().toISOString() },
      });
      if (fnError || !data) {
        let detail = fnError?.message ?? 'unknown';
        try {
          const ctx = (fnError as any)?.context;
          if (ctx) {
            const body = await ctx.clone().json().catch(() => ctx.clone().text());
            detail = typeof body === 'string' ? body : (body?.detail ?? body?.error ?? JSON.stringify(body));
          }
        } catch {}
        setChatMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: `Error: ${detail}` }]);
        return;
      }
      setCollectedFields(data.fields ?? {});
      setPendingComplete(data.complete === true);
      setPendingReply(data.reply ?? '');
    } catch {
      setChatMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  // ─── AI: Submit confirmed quest ────────────────────────────────────────────
  async function handleAiSubmit() {
    if (profile && profile.strikes >= STRIKE_THRESHOLDS.suspend) {
      setError('Quest posting is suspended due to active strikes.');
      return;
    }
    const f = collectedFields;
    await submitQuest({
      title: f.title ?? '',
      description: f.description ?? '',
      tag: (f.tag as QuestTag) || 'errands',
      fulfilment_mode: f.fulfilment_mode ?? 'meetup',
      reward_amount: f.reward_amount ?? 0,
      deadline_label: f.deadline_label as DeadlineLabel,
      location_name: f.location_name ?? 'UTown, NUS',
    });
  }

  // ─── Manual: Submit ────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (profile && profile.strikes >= STRIKE_THRESHOLDS.suspend) {
      setError('Quest posting is suspended due to active strikes.');
      return;
    }
    if (!title.trim()) { setError('Quest title is required.'); return; }
    if (!description.trim() || description.length < 10) { setError('Description must be at least 10 characters.'); return; }
    if (!deadlineLabel) { setError('Please select a deadline.'); return; }
    const deadlineDate = buildDeadlineFromLabel(deadlineLabel as DeadlineLabel);
    if (deadlineDate <= new Date()) { setError('Deadline must be in the future.'); return; }
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
          location_name: preciseLocation.trim()
            ? `${locationName || 'UTown'} — ${preciseLocation.trim()}`
            : (locationName || 'UTown, NUS'),
          latitude: pickedLat ?? UTOWN_LAT, longitude: pickedLon ?? UTOWN_LNG,
          geohash: encodeGeohash(pickedLat ?? UTOWN_LAT, pickedLon ?? UTOWN_LNG),
          status: 'open', is_flash: isFlash, flash_expires_at: flashExpiresAt,
          quest_type: questType,
          max_acceptors: questType === 'crew' ? maxAcceptors : 1,
        })
        .select('id').single();
      if (insertError || !quest) { setError(insertError?.message ?? 'Failed to create quest.'); return; }
      supabase.functions.invoke('process-quest', { body: { quest_id: quest.id } });
      shouldReset.current = true;
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function submitQuest(fields: {
    title: string; description: string; tag: QuestTag;
    fulfilment_mode: 'meetup' | 'dropoff'; reward_amount: number;
    deadline_label: DeadlineLabel; location_name: string;
  }) {
    if (!fields.title.trim()) { setError('Quest title is required.'); return; }
    if (!fields.description.trim() || fields.description.length < 10) { setError('Description must be at least 10 characters.'); return; }
    if (!fields.deadline_label) { setError('Please select a deadline.'); return; }
    const deadlineDate = buildDeadlineFromLabel(fields.deadline_label);
    if (deadlineDate <= new Date()) { setError('Deadline must be in the future.'); return; }
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in.'); return; }
      const { data: quest, error: insertError } = await supabase
        .from('quests')
        .insert({
          poster_id: user.id,
          title: fields.title.trim(), description: fields.description.trim(),
          tag: fields.tag, fulfilment_mode: fields.fulfilment_mode,
          reward_amount: fields.reward_amount,
          deadline: deadlineDate.toISOString(),
          location_name: fields.location_name || 'UTown, NUS',
          latitude: pickedLat ?? UTOWN_LAT, longitude: pickedLon ?? UTOWN_LNG,
          geohash: encodeGeohash(pickedLat ?? UTOWN_LAT, pickedLon ?? UTOWN_LNG),
          status: 'open', is_flash: false, flash_expires_at: null,
          quest_type: 'standard', max_acceptors: 1,
        })
        .select('id').single();
      if (insertError || !quest) { setError(insertError?.message ?? 'Failed to create quest.'); return; }
      supabase.functions.invoke('process-quest', { body: { quest_id: quest.id } });
      shouldReset.current = true;
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function validateDetails() {
    if (!title.trim()) return 'Quest title is required.';
    if (!description.trim() || description.length < 10) return 'Description must be at least 10 characters.';
    return null;
  }

  function next() {
    setError('');
    if (step === 'Details') {
      const err = validateDetails();
      if (err) { setError(err); return; }
    }
    if (step === 'Location') {
      if (!locationName) { setError('Please select a location.'); return; }
    }
    if (step === 'Reward') {
      if (!deadlineLabel) { setError('Please select a deadline.'); return; }
      const d = buildDeadlineFromLabel(deadlineLabel as DeadlineLabel);
      if (d <= new Date()) { setError('Deadline must be in the future.'); return; }
    }
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) setStep(STEPS[nextIndex]);
  }

  function back() { setError(''); const p = stepIndex - 1; if (p >= 0) setStep(STEPS[p]); }

  const f = collectedFields;
  const rewardText = typeof f.reward_amount === 'number' && f.reward_amount > 0
    ? `$${f.reward_amount.toFixed(2)}`
    : 'Favour';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' && postMode === 'ai' ? 90 : 0}
    >
      <ScreenHeader
        title="Post a Quest"
        backAction={postMode === 'manual' && stepIndex > 0}
        onBack={back}
        rightAction={
          <TouchableOpacity
            onPress={() => { resetForm(); resetAiChat(); }}
            hitSlop={12}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color="rgba(255,255,255,0.50)" strokeWidth={2} />
          </TouchableOpacity>
        }
      />

      {/* Mode Toggle — stable position, never remounts */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <ModeToggle value={postMode} onChange={handleModeSwitch} />
      </View>

      {/* ── AI Mode ── */}
      {postMode === 'ai' && (<>

        {/* Chat area */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {chatMessages.map((msg) => (
            <View
              key={msg.id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                marginBottom: 10,
              }}
            >
              <View style={{
                backgroundColor: msg.role === 'user'
                  ? 'rgba(124,58,237,0.75)'
                  : 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: msg.role === 'user'
                  ? 'rgba(124,58,237,0.40)'
                  : 'rgba(255,255,255,0.10)',
                borderRadius: 18,
                borderBottomRightRadius: msg.role === 'user' ? 4 : 18,
                borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 18,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}>
                <Text style={{ color: '#ffffff', fontSize: 14, lineHeight: 21 }}>
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}

          {/* Typing / animating bubble */}
          {(chatLoading || (!animatingDone && animatingText)) && (
            <View style={{ alignSelf: 'flex-start', maxWidth: '80%', marginBottom: 10 }}>
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 18,
                borderBottomLeftRadius: 4,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}>
                {chatLoading && !animatingText ? (
                  <TypingDots />
                ) : (
                  <Text style={{ color: '#ffffff', fontSize: 14, lineHeight: 21 }}>
                    {animatingText}
                  </Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Confirmation card */}
        {questReady && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Card glow>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6 }}>
                QUEST READY TO POST
              </Text>
              {f.title && (
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: -0.4, marginBottom: 10 }}>
                  {f.title}
                </Text>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {f.fulfilment_mode && (
                  <Badge variant="mode" value={f.fulfilment_mode} />
                )}
                {f.deadline_label && (
                  <Badge variant="default" value={f.deadline_label} />
                )}
                <Badge variant="default" value={rewardText} />
                {f.location_name && (
                  <Badge variant="default" value={f.location_name} />
                )}
                {f.tag && (
                  <Badge variant="tag" value={f.tag} />
                )}
              </View>

              {error ? (
                <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{error}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  variant="secondary"
                  size="md"
                  style={{ flex: 1 }}
                  onPress={() => setQuestReady(false)}
                >
                  Keep editing
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  style={{ flex: 1 }}
                  loading={loading}
                  onPress={handleAiSubmit}
                >
                  Post Quest
                </Button>
              </View>
            </Card>
          </View>
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 10,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 100,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(0,0,0,0.80)',
        }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Type a message..."
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
              editable={!chatLoading && animatingDone}
              rounded
            />
          </View>
          <Pressable
            onPress={handleSendMessage}
            disabled={!chatInput.trim() || chatLoading || !animatingDone}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: chatInput.trim() && animatingDone && !chatLoading
                ? '#ffffff'
                : 'rgba(255,255,255,0.10)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 2,
            }}
          >
            <Send
              size={18}
              color={chatInput.trim() && animatingDone && !chatLoading ? '#000000' : 'rgba(255,255,255,0.40)'}
              strokeWidth={2}
            />
          </Pressable>
        </View>
      </>)}

      {/* ── Manual Mode ── */}
      {postMode === 'manual' && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>

          {/* Steps: Details */}
          {step === 'Details' && (<>
          <StepIndicator steps={[...STEPS]} currentIndex={stepIndex} />

          <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginTop: 20, marginBottom: 4 }}>
            What do you need?
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 24 }}>
            Describe your quest clearly.
          </Text>

          {error ? (
            <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</Text>
          ) : null}

          <Input
            label="Quest Title"
            placeholder="e.g. Need someone to pick up food from The Deck"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          <View style={{ height: 16 }} />

          <Input
            label="Description"
            placeholder="More details — what exactly do you need, any special instructions..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />

          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginTop: 20, marginBottom: 12 }}>
            CATEGORY (OPTIONAL)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {QUEST_TAGS.map((t) => (
              <Chip
                key={t}
                label={t.charAt(0).toUpperCase() + t.slice(1)}
                selected={tag === t}
                color={(TAG_COLOURS as Record<string, string>)[t]}
                onPress={() => setTag(tag === t ? '' : t)}
              />
            ))}
          </View>

          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 }}>
            QUEST TYPE
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {(['standard', 'social', 'crew'] as const).map((qt) => (
              <Chip
                key={qt}
                label={qt.charAt(0).toUpperCase() + qt.slice(1)}
                selected={questType === qt}
                onPress={() => setQuestType(qt)}
              />
            ))}
          </View>

          {questType === 'social' && (
            <View style={{ backgroundColor: 'rgba(217,70,239,0.08)', borderWidth: 1, borderColor: 'rgba(217,70,239,0.20)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#d946ef', fontSize: 13, lineHeight: 19 }}>
                Social quests are for community activities — no payment involved.
              </Text>
            </View>
          )}

          {questType === 'crew' && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
                CREW SIZE
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[2, 3, 4, 5].map((n) => (
                  <Chip
                    key={n}
                    label={String(n)}
                    selected={maxAcceptors === n}
                    onPress={() => setMaxAcceptors(n)}
                  />
                ))}
              </View>
            </View>
          )}

          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 }}>
            FULFILMENT MODE
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28 }}>
            {(['meetup', 'dropoff'] as FulfilmentMode[]).map((m) => (
              <Card
                key={m}
                variant={mode === m ? 'elevated' : 'default'}
                glow={mode === m}
                onPress={() => setMode(m)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 20 }}
              >
                {m === 'meetup'
                  ? <Users size={22} color={mode === m ? '#a78bfa' : 'rgba(255,255,255,0.40)'} strokeWidth={1.8} />
                  : <Package size={22} color={mode === m ? '#a78bfa' : 'rgba(255,255,255,0.40)'} strokeWidth={1.8} />
                }
                <Text style={{
                  color: mode === m ? '#ffffff' : 'rgba(255,255,255,0.50)',
                  fontSize: 13,
                  fontWeight: '600',
                  marginTop: 8,
                }}>
                  {m === 'meetup' ? 'Meet Up' : 'Drop Off'}
                </Text>
              </Card>
            ))}
          </View>

          {/* Live preview */}
          {title.trim() && (
            <View style={{ marginTop: 24, marginBottom: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
                PREVIEW
              </Text>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, lineHeight: 22 }} numberOfLines={2}>
                    {title}
                  </Text>
                  {tag ? (
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                      backgroundColor: (TAG_COLOURS[tag] ?? '#7c3aed') + '22',
                    }}>
                      <Text style={{ color: TAG_COLOURS[tag] ?? '#a78bfa', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                        {tag}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {description.trim() ? (
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, marginBottom: 10 }} numberOfLines={3}>
                    {description}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Badge variant="mode" value={mode} />
                  {questType !== 'standard' && <Badge variant="default" value={questType} />}
                </View>
              </Card>
            </View>
          )}

          <Button variant="primary" size="lg" onPress={next} style={{ width: '100%' }}>
            Next
          </Button>
          </>)}

          {/* Steps: Location */}
          {step === 'Location' && (<>
          <StepIndicator steps={[...STEPS]} currentIndex={stepIndex} />

          <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginTop: 20, marginBottom: 4 }}>
            Where?
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 24 }}>
            Search for a location, then add a precise spot.
          </Text>

          {error ? (
            <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</Text>
          ) : null}

          {/* Location search */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 }}>
              LOCATION
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: locationName ? 'rgba(124,58,237,0.50)' : 'rgba(255,255,255,0.10)',
              borderRadius: 14, paddingHorizontal: 14, height: 50,
            }}>
              <Search size={16} color={locationName ? '#a78bfa' : 'rgba(255,255,255,0.30)'} />
              <TextInput
                value={locationSearch}
                onChangeText={(t) => {
                  setLocationSearch(t);
                  if (!t) { setLocationName(''); setPickedLat(null); setPickedLon(null); }
                }}
                placeholder={locationName || 'Search RC4, Frontier, The Deck…'}
                placeholderTextColor={locationName ? '#a78bfa' : 'rgba(255,255,255,0.30)'}
                style={{ flex: 1, color: '#fff', fontSize: 15 }}
              />
              {locationName ? (
                <TouchableOpacity onPress={() => { setLocationName(''); setLocationSearch(''); setPickedLat(null); setPickedLon(null); }} hitSlop={8}>
                  <X size={14} color="rgba(255,255,255,0.40)" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Autocomplete dropdown */}
            {locationSearch.trim().length > 0 && (() => {
              const results = NUS_LOCATIONS.filter((l) =>
                l.name.toLowerCase().includes(locationSearch.toLowerCase())
              ).slice(0, 6);
              return results.length > 0 ? (
                <View style={{
                  backgroundColor: 'rgba(18,18,22,0.97)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                  borderRadius: 14, marginTop: 4, overflow: 'hidden',
                }}>
                  {results.map((loc, i) => (
                    <TouchableOpacity
                      key={loc.name}
                      onPress={() => {
                        setLocationName(loc.name);
                        setLocationSearch('');
                        setPickedLat(loc.latitude);
                        setPickedLon(loc.longitude);
                      }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingHorizontal: 14, paddingVertical: 13,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: 'rgba(255,255,255,0.06)',
                      }}
                      activeOpacity={0.7}
                    >
                      <MapPin size={14} color="rgba(255,255,255,0.35)" />
                      <Text style={{ color: '#fff', fontSize: 14, flex: 1 }}>{loc.name}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textTransform: 'capitalize' }}>
                        {loc.category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 13 }}>No locations found</Text>
                </View>
              );
            })()}
          </View>

          {/* Precise location — shown after a location is selected */}
          {locationName ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 }}>
                PRECISE SPOT (OPTIONAL)
              </Text>
              <Input
                placeholder="e.g. Next to Jollibee, Level 1"
                value={preciseLocation}
                onChangeText={setPreciseLocation}
              />
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 6 }}>
                Shown as: <Text style={{ color: 'rgba(255,255,255,0.50)' }}>
                  {preciseLocation.trim() ? `${locationName} — ${preciseLocation.trim()}` : locationName}
                </Text>
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 28 }}>
            <Button variant="secondary" size="lg" style={{ flex: 1 }} onPress={back}>
              Back
            </Button>
            <Button variant="primary" size="lg" style={{ flex: 1 }} onPress={next}>
              Next
            </Button>
          </View>
          </>)}

          {/* Steps: Reward & Deadline */}
          {step === 'Reward' && (<>
          <StepIndicator steps={[...STEPS]} currentIndex={stepIndex} />

        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginTop: 20, marginBottom: 4 }}>
          Reward & Deadline
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 24 }}>
          How much are you offering and by when?
        </Text>

        {error ? (
          <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</Text>
        ) : null}

        <Input
          label="Cash Reward (SGD, optional)"
          placeholder="e.g. 3.50"
          keyboardType="decimal-pad"
          value={reward}
          onChangeText={setReward}
        />
        {(() => {
          const suggestion = suggestPrice(tag);
          if (!suggestion) return null;
          if (suggestion.min === 0 && suggestion.max === 0) return null;
          const midpoint = Math.round((suggestion.min + suggestion.max) / 2 * 2) / 2;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 4 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, flex: 1 }}>
                💡 Suggested: ${suggestion.min}–${suggestion.max} for {suggestion.label.toLowerCase()}
              </Text>
              <Pressable
                onPress={() => setReward(String(midpoint))}
                style={{ backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}
              >
                <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '700' }}>Use</Text>
              </Pressable>
            </View>
          );
        })()}
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 6, marginBottom: 20 }}>
          Leave blank for favour-only quests. Payment settled privately via PayNow/cash.
        </Text>

        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 }}>
          DEADLINE
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {DEADLINE_LABELS.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={deadlineLabel === label}
              onPress={() => setDeadlineLabel(label)}
            />
          ))}
        </View>

        {/* Flash Quest toggle */}
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'rgba(245,158,11,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(245,158,11,0.20)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Zap size={16} color="#f59e0b" strokeWidth={2} />
            </View>
            <View>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 2 }}>
                Flash Quest
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12 }}>
                Urgent — expires in 30 minutes
              </Text>
            </View>
          </View>
          <Switch
            value={isFlash}
            onValueChange={setIsFlash}
            trackColor={{ false: 'rgba(255,255,255,0.10)', true: '#7c3aed' }}
            thumbColor="#ffffff"
          />
        </Card>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button variant="secondary" size="lg" style={{ flex: 1 }} onPress={back}>
            Back
          </Button>
          <Button variant="primary" size="lg" style={{ flex: 1 }} loading={loading} onPress={handleSubmit}>
            Post Quest
          </Button>
        </View>
          </>)}

        </ScrollView>
      )}

    </KeyboardAvoidingView>
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
 