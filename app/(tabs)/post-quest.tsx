import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { encodeGeohash } from '@/lib/geohash';
import { QUEST_TAGS } from '@/constants';
import type { QuestTag, FulfilmentMode } from '@/types/database';

// NUS UTown rough centre
const UTOWN_LAT = 1.3063;
const UTOWN_LNG = 103.7733;

const STEPS = ['Details', 'Location', 'Reward'] as const;
type Step = (typeof STEPS)[number];

const DEADLINE_LABELS = ['1 hour', '3 hours', 'Tonight (10 PM)', 'Tomorrow noon'] as const;
type DeadlineLabel = (typeof DEADLINE_LABELS)[number];

function buildDeadlineFromLabel(label: DeadlineLabel): Date {
  switch (label) {
    case '1 hour':
      return new Date(Date.now() + 1 * 3600 * 1000);
    case '3 hours':
      return new Date(Date.now() + 3 * 3600 * 1000);
    case 'Tonight (10 PM)':
      return todayAt(22);
    case 'Tomorrow noon':
      return tomorrowAt(12);
  }
}

// ─── Chat types ──────────────────────────────────────────────────────────────
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

export default function PostQuest() {
  // Mode: AI natural language or manual form
  const [postMode, setPostMode] = useState<'ai' | 'manual'>('ai');

  // ── AI chat state ──────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: nextId(), role: 'assistant', content: GREETING },
  ]);
  const [collectedFields, setCollectedFields] = useState<Partial<QuestFields>>({});
  const [chatLoading, setChatLoading] = useState(false);
  const [questReady, setQuestReady] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Typing animation state
  const [pendingReply, setPendingReply] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [animatingText, setAnimatingText] = useState('');
  const [animatingDone, setAnimatingDone] = useState(true);

  const scrollRef = useRef<ScrollView>(null);

  // ── Shared form state (manual + AI pre-fill before submit) ─────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<QuestTag | ''>('');
  const [mode, setMode] = useState<FulfilmentMode>('meetup');
  const [reward, setReward] = useState('');
  const [deadlineLabel, setDeadlineLabel] = useState<DeadlineLabel | ''>('');
  const [locationName, setLocationName] = useState('UTown, NUS');
  const [isFlash, setIsFlash] = useState(false);

  // Step & async state (manual mode)
  const [step, setStep] = useState<Step>('Details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        setChatMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', content: pendingReply },
        ]);
        setPendingReply(null);
        if (pendingComplete) setQuestReady(true);
      }
    }, 12);
    return () => clearInterval(interval);
  }, [pendingReply]);

  // Auto-scroll on new messages
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatMessages, animatingText, chatLoading]);

  function resetForm() {
    setTitle('');
    setDescription('');
    setTag('');
    setMode('meetup');
    setReward('');
    setDeadlineLabel('');
    setLocationName('UTown, NUS');
    setIsFlash(false);
    setStep('Details');
    setError('');
  }

  function resetAiChat() {
    setChatMessages([{ id: nextId(), role: 'assistant', content: GREETING }]);
    setCollectedFields({});
    setChatLoading(false);
    setQuestReady(false);
    setChatInput('');
    setPendingReply(null);
    setPendingComplete(false);
    setAnimatingText('');
    setAnimatingDone(true);
  }

  function handleModeSwitch(m: 'ai' | 'manual') {
    setPostMode(m);
    resetAiChat();
    resetForm();
    setError('');
  }

  // ─── AI: Send message ───────────────────────────────────────────────────────
  async function handleSendMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading || !animatingDone) return;

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    setError('');

    try {
      // Build messages array for the API (exclude greeting from assistant history
      // since it wasn't an API response, but include it as context)
      const historyForApi = [...chatMessages, userMsg].map(({ role, content }) => ({
        role,
        content,
      }));

      const { data, error: fnError } = await supabase.functions.invoke('chat-quest', {
        body: {
          messages: historyForApi,
          collected_fields: collectedFields,
          current_time: new Date().toISOString(),
        },
      });

      if (fnError || !data) {
        let detail = fnError?.message ?? 'unknown';
        try {
          // FunctionsHttpError has a .context Response — read the actual body
          const ctx = (fnError as any)?.context;
          if (ctx) {
            const body = await ctx.clone().json().catch(() => ctx.clone().text());
            detail = typeof body === 'string' ? body : (body?.detail ?? body?.error ?? JSON.stringify(body));
          }
        } catch {}
        console.error('chat-quest error body:', detail);
        setChatMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: `Error: ${detail}`,
          },
        ]);
        return;
      }

      // Merge newly collected fields
      setCollectedFields(data.fields ?? {});

      // Start typing animation
      setPendingComplete(data.complete === true);
      setPendingReply(data.reply ?? '');
    } catch (e: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // ─── Pre-fill shared form state then submit ─────────────────────────────────
  async function handleAiSubmit() {
    const f = collectedFields;
    if (f.title) setTitle(f.title);
    if (f.description) setDescription(f.description);
    if (f.tag && QUEST_TAGS.includes(f.tag as QuestTag)) setTag(f.tag as QuestTag);
    if (f.fulfilment_mode === 'meetup' || f.fulfilment_mode === 'dropoff') setMode(f.fulfilment_mode);
    if (typeof f.reward_amount === 'number') setReward(String(f.reward_amount));
    if (f.deadline_label && DEADLINE_LABELS.includes(f.deadline_label as DeadlineLabel)) {
      setDeadlineLabel(f.deadline_label as DeadlineLabel);
    }
    if (f.location_name) setLocationName(f.location_name);

    // Use a small timeout so state updates flush before handleSubmit reads them
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

  // ─── Submit (shared) ────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!title.trim()) { setError('Quest title is required.'); return; }
    if (!description.trim() || description.length < 20) {
      setError('Description must be at least 20 characters.');
      return;
    }
    if (!deadlineLabel) { setError('Please select a deadline.'); return; }
    const deadlineDate = buildDeadlineFromLabel(deadlineLabel as DeadlineLabel);
    if (deadlineDate <= new Date()) { setError('Deadline must be in the future.'); return; }

    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in.'); return; }

      const flashExpiresAt = isFlash
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
        : null;

      const { data: quest, error: insertError } = await supabase
        .from('quests')
        .insert({
          poster_id: user.id,
          title: title.trim(),
          description: description.trim(),
          tag: (tag || 'errands') as QuestTag,
          fulfilment_mode: mode,
          reward_amount: parseFloat(reward) || 0,
          deadline: deadlineDate.toISOString(),
          location_name: locationName || 'UTown, NUS',
          latitude: UTOWN_LAT,
          longitude: UTOWN_LNG,
          geohash: encodeGeohash(UTOWN_LAT, UTOWN_LNG),
          status: 'open',
          is_flash: isFlash,
          flash_expires_at: flashExpiresAt,
        })
        .select('id')
        .single();

      if (insertError || !quest) {
        setError(insertError?.message ?? 'Failed to create quest.');
        return;
      }

      supabase.functions.invoke('process-quest', { body: { quest_id: quest.id } });

      resetForm();
      resetAiChat();
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // Direct submit from AI mode (bypasses shared state)
  async function submitQuest(fields: {
    title: string;
    description: string;
    tag: QuestTag;
    fulfilment_mode: 'meetup' | 'dropoff';
    reward_amount: number;
    deadline_label: DeadlineLabel;
    location_name: string;
  }) {
    if (!fields.title.trim()) { setError('Quest title is required.'); return; }
    if (!fields.description.trim() || fields.description.length < 20) {
      setError('Description must be at least 20 characters.');
      return;
    }
    if (!fields.deadline_label) { setError('Please select a deadline.'); return; }
    const deadlineDate = buildDeadlineFromLabel(fields.deadline_label);
    if (deadlineDate <= new Date()) { setError('Deadline must be in the future.'); return; }

    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in.'); return; }

      const { data: quest, error: insertError } = await supabase
        .from('quests')
        .insert({
          poster_id: user.id,
          title: fields.title.trim(),
          description: fields.description.trim(),
          tag: fields.tag,
          fulfilment_mode: fields.fulfilment_mode,
          reward_amount: fields.reward_amount,
          deadline: deadlineDate.toISOString(),
          location_name: fields.location_name || 'UTown, NUS',
          latitude: UTOWN_LAT,
          longitude: UTOWN_LNG,
          geohash: encodeGeohash(UTOWN_LAT, UTOWN_LNG),
          status: 'open',
          is_flash: false,
          flash_expires_at: null,
        })
        .select('id')
        .single();

      if (insertError || !quest) {
        setError(insertError?.message ?? 'Failed to create quest.');
        return;
      }

      supabase.functions.invoke('process-quest', { body: { quest_id: quest.id } });

      resetForm();
      resetAiChat();
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Manual form validation helpers ────────────────────────────────────────
  function validateDetails() {
    if (!title.trim()) return 'Quest title is required.';
    if (!description.trim() || description.length < 20)
      return 'Description must be at least 20 characters.';
    return null;
  }

  function validateReward() {
    const r = parseFloat(reward);
    if (reward && (isNaN(r) || r < 0)) return 'Reward must be a positive number.';
    if (!deadlineLabel) return 'Please select a deadline.';
    const deadlineDate = buildDeadlineFromLabel(deadlineLabel as DeadlineLabel);
    if (deadlineDate <= new Date()) return 'Deadline must be in the future.';
    return null;
  }

  function next() {
    setError('');
    if (step === 'Details') {
      const err = validateDetails();
      if (err) { setError(err); return; }
    }
    if (step === 'Reward') {
      const err = validateReward();
      if (err) { setError(err); return; }
    }
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) setStep(STEPS[nextIndex]);
  }

  function back() {
    setError('');
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) setStep(STEPS[prevIndex]);
  }

  // ─── Mode toggle (always shown at top) ─────────────────────────────────────
  const ModeToggle = () => (
    <View className="flex-row bg-surface rounded-full p-1 mb-6 self-start">
      <Pressable
        className={`px-5 py-2 rounded-full ${postMode === 'ai' ? 'bg-accent' : ''}`}
        onPress={() => handleModeSwitch('ai')}
      >
        <Text className={`text-sm font-semibold ${postMode === 'ai' ? 'text-white' : 'text-muted'}`}>
          AI
        </Text>
      </Pressable>
      <Pressable
        className={`px-5 py-2 rounded-full ${postMode === 'manual' ? 'bg-accent' : ''}`}
        onPress={() => handleModeSwitch('manual')}
      >
        <Text className={`text-sm font-semibold ${postMode === 'manual' ? 'text-white' : 'text-muted'}`}>
          Manual
        </Text>
      </Pressable>
    </View>
  );

  // ─── Step indicator (manual mode) ──────────────────────────────────────────
  const StepBar = () => (
    <View className="flex-row mb-8 gap-2">
      {STEPS.map((s, i) => (
        <View
          key={s}
          className={`flex-1 h-1 rounded-full ${i <= stepIndex ? 'bg-accent' : 'bg-surface-2'}`}
        />
      ))}
    </View>
  );

  // ─── AI Mode: Chat interface ────────────────────────────────────────────────
  if (postMode === 'ai') {
    const f = collectedFields;
    const rewardText = typeof f.reward_amount === 'number' && f.reward_amount > 0
      ? `$${f.reward_amount.toFixed(2)}`
      : 'Favour';

    return (
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 }}>
          <ModeToggle />
        </View>

        {/* Chat scroll area */}
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {chatMessages.map((msg) => (
            <View
              key={msg.id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  backgroundColor: msg.role === 'user' ? '#7C3AED' : '#1f2937',
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}

          {/* Typing / loading bubble */}
          {(chatLoading || (!animatingDone && animatingText)) && (
            <View style={{ alignSelf: 'flex-start', maxWidth: '80%', marginBottom: 8 }}>
              <View
                style={{
                  backgroundColor: '#1f2937',
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                {chatLoading && !animatingText ? (
                  <Text style={{ color: '#9ca3af', fontSize: 14 }}>...</Text>
                ) : (
                  <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>
                    {animatingText}
                  </Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Confirmation card */}
        {questReady && (
          <View
            style={{
              margin: 16,
              backgroundColor: '#111827',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: '#7C3AED',
            }}
          >
            <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>Quest ready to post</Text>
            {f.title ? (
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
                {f.title}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {f.fulfilment_mode ? (
                <View style={{ backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#d1d5db', fontSize: 12 }}>
                    {f.fulfilment_mode === 'meetup' ? 'Meet Up' : 'Drop Off'}
                  </Text>
                </View>
              ) : null}
              {f.deadline_label ? (
                <View style={{ backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#d1d5db', fontSize: 12 }}>{f.deadline_label}</Text>
                </View>
              ) : null}
              <View style={{ backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: '#d1d5db', fontSize: 12 }}>{rewardText}</Text>
              </View>
              {f.location_name ? (
                <View style={{ backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#d1d5db', fontSize: 12 }}>{f.location_name}</Text>
                </View>
              ) : null}
              {f.tag ? (
                <View style={{ backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#d1d5db', fontSize: 12 }}>{f.tag}</Text>
                </View>
              ) : null}
            </View>

            {error ? <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#374151',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={() => setQuestReady(false)}
              >
                <Text style={{ color: '#9ca3af', fontWeight: '600' }}>Keep editing</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: '#7C3AED',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={handleAiSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Post Quest</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Input bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            gap: 10,
            borderTopWidth: 1,
            borderTopColor: '#1f2937',
            backgroundColor: '#0a0a0a',
          }}
        >
          <TextInput
            style={{
              flex: 1,
              backgroundColor: '#1f2937',
              color: '#fff',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 14,
              maxHeight: 100,
            }}
            placeholder="Type a message..."
            placeholderTextColor="#6b7280"
            value={chatInput}
            onChangeText={setChatInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSendMessage}
            editable={!chatLoading && animatingDone}
          />
          <Pressable
            style={{
              backgroundColor: chatInput.trim() && animatingDone && !chatLoading ? '#7C3AED' : '#374151',
              borderRadius: 20,
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={handleSendMessage}
            disabled={!chatInput.trim() || chatLoading || !animatingDone}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── Manual Mode: Step: Details ─────────────────────────────────────────────
  if (postMode === 'manual' && step === 'Details') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ padding: 32, paddingTop: 60 }}>
          <ModeToggle />
          <StepBar />
          <Text className="text-2xl font-bold text-white mb-1">What do you need?</Text>
          <Text className="text-muted mb-6 text-sm">Describe your quest clearly.</Text>

          {error ? <Text className="text-danger mb-4 text-sm">{error}</Text> : null}

          <Text className="text-muted text-sm mb-1">Quest Title</Text>
          <TextInput
            className="bg-surface text-white rounded-xl px-4 py-3 mb-4"
            placeholder="e.g. Need someone to pick up food from The Deck"
            placeholderTextColor="#6b7280"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          <Text className="text-muted text-sm mb-1">Description</Text>
          <TextInput
            className="bg-surface text-white rounded-xl px-4 py-3 mb-4"
            placeholder="More details — what exactly do you need, any special instructions..."
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
            style={{ minHeight: 100 }}
          />

          <Text className="text-muted text-sm mb-2">Category (optional)</Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {QUEST_TAGS.map((t) => (
              <Pressable
                key={t}
                className={`px-3 py-2 rounded-full border ${
                  tag === t ? 'bg-accent border-accent' : 'border-surface-2'
                }`}
                onPress={() => setTag(tag === t ? '' : t)}
              >
                <Text className={tag === t ? 'text-white text-sm' : 'text-muted text-sm'}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-muted text-sm mb-2">Fulfilment Mode</Text>
          <View className="flex-row gap-3 mb-8">
            {(['meetup', 'dropoff'] as FulfilmentMode[]).map((m) => (
              <Pressable
                key={m}
                className={`flex-1 py-3 rounded-xl border items-center ${
                  mode === m ? 'bg-accent border-accent' : 'border-surface-2'
                }`}
                onPress={() => setMode(m)}
              >
                <Text className={`text-sm mt-1 ${mode === m ? 'text-white' : 'text-muted'}`}>
                  {m === 'meetup' ? 'Meet Up' : 'Drop Off'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable className="bg-accent rounded-2xl py-4 items-center" onPress={next}>
            <Text className="text-white font-semibold text-base">Next</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Manual Mode: Step: Location ────────────────────────────────────────────
  if (postMode === 'manual' && step === 'Location') {
    const RC_LOCATIONS = [
      'Tembusu College', 'CAPT', 'RC4', 'RVRC', 'Acacia', 'NUSC', 'UTR',
      'The Deck', 'Frontier', 'Fine Food', 'UTown Green', 'Stephen Riady Centre',
    ];
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 32, paddingTop: 60 }}>
        <ModeToggle />
        <StepBar />
        <Text className="text-2xl font-bold text-white mb-1">Where?</Text>
        <Text className="text-muted mb-6 text-sm">Select a UTown location or type a custom one.</Text>

        {error ? <Text className="text-danger mb-4 text-sm">{error}</Text> : null}

        <Text className="text-muted text-sm mb-1">Location</Text>
        <TextInput
          className="bg-surface text-white rounded-xl px-4 py-3 mb-4"
          placeholder="e.g. RC4 Lounge, Level 2"
          placeholderTextColor="#6b7280"
          value={locationName}
          onChangeText={setLocationName}
        />

        <Text className="text-muted text-sm mb-2">Quick select</Text>
        <View className="flex-row flex-wrap gap-2 mb-8">
          {RC_LOCATIONS.map((loc) => (
            <Pressable
              key={loc}
              className={`px-3 py-2 rounded-full border ${
                locationName === loc ? 'bg-accent border-accent' : 'border-surface-2'
              }`}
              onPress={() => setLocationName(loc)}
            >
              <Text className={locationName === loc ? 'text-white text-sm' : 'text-muted text-sm'}>
                {loc}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row gap-3">
          <Pressable className="flex-1 border border-surface-2 rounded-2xl py-4 items-center" onPress={back}>
            <Text className="text-muted font-semibold">Back</Text>
          </Pressable>
          <Pressable className="flex-1 bg-accent rounded-2xl py-4 items-center" onPress={next}>
            <Text className="text-white font-semibold">Next</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ─── Manual Mode: Step: Reward & Deadline ──────────────────────────────────
  if (postMode === 'manual' && step === 'Reward') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ padding: 32, paddingTop: 60 }}>
          <ModeToggle />
          <StepBar />
          <Text className="text-2xl font-bold text-white mb-1">Reward & Deadline</Text>
          <Text className="text-muted mb-6 text-sm">How much are you offering and by when?</Text>

          {error ? <Text className="text-danger mb-4 text-sm">{error}</Text> : null}

          <Text className="text-muted text-sm mb-1">Cash Reward (SGD, optional)</Text>
          <TextInput
            className="bg-surface text-white rounded-xl px-4 py-3 mb-2"
            placeholder="e.g. 3.50"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
            value={reward}
            onChangeText={setReward}
          />
          <Text className="text-muted text-xs mb-6">
            Leave blank for favour-only quests. Payment settled privately via PayNow/cash.
          </Text>

          <Text className="text-muted text-sm mb-2">Deadline</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {DEADLINE_LABELS.map((label) => (
              <Pressable
                key={label}
                className={`px-4 py-2 rounded-full border ${
                  deadlineLabel === label ? 'bg-accent border-accent' : 'border-surface-2'
                }`}
                onPress={() => setDeadlineLabel(label)}
              >
                <Text className={deadlineLabel === label ? 'text-white text-sm' : 'text-muted text-sm'}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-center mb-8">
            <Pressable
              className={`w-6 h-6 rounded border mr-3 items-center justify-center ${
                isFlash ? 'bg-accent border-accent' : 'border-surface-2'
              }`}
              onPress={() => setIsFlash(!isFlash)}
            >
              {isFlash && <Text className="text-white text-xs font-bold">✓</Text>}
            </Pressable>
            <View>
              <Text className="text-white text-sm font-semibold">Flash Quest</Text>
              <Text className="text-muted text-xs">Urgent — expires in 30 minutes</Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <Pressable className="flex-1 border border-surface-2 rounded-2xl py-4 items-center" onPress={back}>
              <Text className="text-muted font-semibold">Back</Text>
            </Pressable>
            <Pressable
              className="flex-1 bg-accent rounded-2xl py-4 items-center"
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Post Quest</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return null;
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
