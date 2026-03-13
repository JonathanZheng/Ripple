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
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { encodeGeohash } from '@/lib/geohash';
import { QUEST_TAGS, TRUST_TIER_CONFIG } from '@/constants';
import type { QuestTag, FulfilmentMode } from '@/types/database';

// NUS UTown rough centre
const UTOWN_LAT = 1.3063;
const UTOWN_LNG = 103.7733;

const TAG_EMOJI: Record<QuestTag, string> = {
  food: '🍜',
  transport: '🚌',
  social: '🎉',
  skills: '💡',
  errands: '📦',
};

const STEPS = ['Details', 'Location', 'Reward', 'Review'] as const;
type Step = (typeof STEPS)[number];

export default function PostQuest() {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<QuestTag | ''>('');
  const [mode, setMode] = useState<FulfilmentMode>('meetup');
  const [reward, setReward] = useState('');
  const [deadline, setDeadline] = useState('');      // ISO string or relative label
  const [locationName, setLocationName] = useState('UTown, NUS');
  const [isFlash, setIsFlash] = useState(false);

  // Step & async state
  const [step, setStep] = useState<Step>('Details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState<{
    tag: QuestTag;
    ai_title: string;
    suggested_price_min: number;
    suggested_price_max: number;
  } | null>(null);

  const stepIndex = STEPS.indexOf(step);

  function validateDetails() {
    if (!title.trim()) return 'Quest title is required.';
    if (!description.trim() || description.length < 20)
      return 'Description must be at least 20 characters.';
    return null;
  }

  function validateReward() {
    const r = parseFloat(reward);
    if (reward && (isNaN(r) || r < 0)) return 'Reward must be a positive number.';
    const deadlineDate = buildDeadline();
    if (!deadlineDate) return 'Please select a deadline.';
    if (deadlineDate <= new Date()) return 'Deadline must be in the future.';
    return null;
  }

  function buildDeadline(): Date | null {
    if (!deadline) return null;
    const d = new Date(deadline);
    return isNaN(d.getTime()) ? null : d;
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

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in.'); return; }

      const deadlineDate = buildDeadline()!;
      const flashExpiresAt = isFlash
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
        : null;

      // Insert quest row with the user-supplied tag (AI may override it)
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

      // Invoke AI Edge Function (fire-and-forget with a brief wait for demo)
      const { data: aiData } = await supabase.functions.invoke('process-quest', {
        body: { quest_id: quest.id },
      });

      if (aiData) {
        setAiResult(aiData as typeof aiResult);
        setStep('Review');
        // Don't navigate yet — show the AI result to the user first
        return;
      }

      // If AI call failed, just navigate away (quest is still created)
      router.replace('/(tabs)/feed');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Review step after AI processes ───────────────────────────────────────
  if (step === 'Review' && aiResult) {
    return (
      <View className="flex-1 bg-background px-8 justify-center">
        <Text className="text-2xl font-bold text-white mb-2">Quest created! ✨</Text>
        <Text className="text-muted mb-6">Here's what the AI came up with:</Text>

        <View className="bg-surface rounded-2xl p-5 mb-6">
          <Text className="text-accent text-xs font-semibold mb-1 uppercase tracking-widest">
            {TAG_EMOJI[aiResult.tag]} {aiResult.tag}
          </Text>
          <Text className="text-white text-lg font-bold mb-4">"{aiResult.ai_title}"</Text>

          {(aiResult.suggested_price_min > 0 || aiResult.suggested_price_max > 0) && (
            <Text className="text-muted text-sm">
              Suggested reward: ${aiResult.suggested_price_min}–${aiResult.suggested_price_max}
            </Text>
          )}
        </View>

        <Pressable
          className="bg-accent rounded-2xl py-4 items-center"
          onPress={() => router.replace('/(tabs)/feed')}
        >
          <Text className="text-white font-semibold text-base">View in Feed</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Step indicator ────────────────────────────────────────────────────────
  const StepBar = () => (
    <View className="flex-row mb-8 gap-2">
      {STEPS.slice(0, 3).map((s, i) => (
        <View
          key={s}
          className={`flex-1 h-1 rounded-full ${i <= stepIndex ? 'bg-accent' : 'bg-surface-2'}`}
        />
      ))}
    </View>
  );

  // ─── Step: Details ─────────────────────────────────────────────────────────
  if (step === 'Details') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ padding: 32, paddingTop: 60 }}>
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

          <Text className="text-muted text-sm mb-2">Category (optional — AI will auto-tag)</Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {QUEST_TAGS.map((t) => (
              <Pressable
                key={t}
                className={`px-3 py-2 rounded-full border flex-row items-center gap-1 ${
                  tag === t ? 'bg-accent border-accent' : 'border-surface-2'
                }`}
                onPress={() => setTag(tag === t ? '' : t)}
              >
                <Text>{TAG_EMOJI[t]}</Text>
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
                <Text className="text-lg">{m === 'meetup' ? '🤝' : '📬'}</Text>
                <Text className={`text-sm mt-1 ${mode === m ? 'text-white' : 'text-muted'}`}>
                  {m === 'meetup' ? 'Meet Up' : 'Drop Off'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable className="bg-accent rounded-2xl py-4 items-center" onPress={next}>
            <Text className="text-white font-semibold text-base">Next →</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Step: Location ────────────────────────────────────────────────────────
  if (step === 'Location') {
    const RC_LOCATIONS = [
      'Tembusu College', 'CAPT', 'RC4', 'RVRC', 'Acacia', 'NUSC', 'UTR',
      'The Deck', 'Frontier', 'Fine Food', 'UTown Green', 'Stephen Riady Centre',
    ];
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 32, paddingTop: 60 }}>
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
            <Text className="text-muted font-semibold">← Back</Text>
          </Pressable>
          <Pressable className="flex-1 bg-accent rounded-2xl py-4 items-center" onPress={next}>
            <Text className="text-white font-semibold">Next →</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ─── Step: Reward & Deadline ───────────────────────────────────────────────
  if (step === 'Reward') {
    const DEADLINE_OPTIONS = [
      { label: '1 hour', hours: 1 },
      { label: '3 hours', hours: 3 },
      { label: 'Tonight (10 PM)', hours: null, fixed: todayAt(22) },
      { label: 'Tomorrow noon', hours: null, fixed: tomorrowAt(12) },
    ];

    return (
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ padding: 32, paddingTop: 60 }}>
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
            {DEADLINE_OPTIONS.map((opt) => {
              const isoVal = opt.fixed
                ? opt.fixed.toISOString()
                : new Date(Date.now() + (opt.hours ?? 0) * 3600 * 1000).toISOString();
              return (
                <Pressable
                  key={opt.label}
                  className={`px-4 py-2 rounded-full border ${
                    deadline === isoVal ? 'bg-accent border-accent' : 'border-surface-2'
                  }`}
                  onPress={() => setDeadline(isoVal)}
                >
                  <Text className={deadline === isoVal ? 'text-white text-sm' : 'text-muted text-sm'}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
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
              <Text className="text-white text-sm font-semibold">⚡ Flash Quest</Text>
              <Text className="text-muted text-xs">Urgent — expires in 30 minutes</Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <Pressable className="flex-1 border border-surface-2 rounded-2xl py-4 items-center" onPress={back}>
              <Text className="text-muted font-semibold">← Back</Text>
            </Pressable>
            <Pressable
              className="flex-1 bg-accent rounded-2xl py-4 items-center"
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Post Quest ✦</Text>
              )}
            </Pressable>
          </View>

          {loading && (
            <Text className="text-muted text-xs text-center mt-4">
              AI is generating your quest title and tag…
            </Text>
          )}
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
