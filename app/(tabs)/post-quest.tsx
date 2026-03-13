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

export default function PostQuest() {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<QuestTag | ''>('');
  const [mode, setMode] = useState<FulfilmentMode>('meetup');
  const [reward, setReward] = useState('');
  const [deadlineLabel, setDeadlineLabel] = useState<DeadlineLabel | ''>('');
  const [locationName, setLocationName] = useState('UTown, NUS');
  const [isFlash, setIsFlash] = useState(false);

  // Step & async state
  const [step, setStep] = useState<Step>('Details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (!deadlineLabel) return 'Please select a deadline.';
    const deadlineDate = buildDeadlineFromLabel(deadlineLabel);
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

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in.'); return; }

      const deadlineDate = buildDeadlineFromLabel(deadlineLabel as DeadlineLabel);
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

      // Fire-and-forget AI processing (tagging + embedding)
      supabase.functions.invoke('process-quest', { body: { quest_id: quest.id } });

      router.replace('/(tabs)/feed');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Step indicator ────────────────────────────────────────────────────────
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
            <Text className="text-muted font-semibold">Back</Text>
          </Pressable>
          <Pressable className="flex-1 bg-accent rounded-2xl py-4 items-center" onPress={next}>
            <Text className="text-white font-semibold">Next</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ─── Step: Reward & Deadline ───────────────────────────────────────────────
  if (step === 'Reward') {
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
