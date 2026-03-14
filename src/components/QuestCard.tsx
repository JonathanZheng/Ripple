import { View, Text, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { formatDistanceToNow, isPast } from 'date-fns';
import { TAG_COLOURS, TRUST_TIER_CONFIG } from '@/constants';
import type { Quest, TrustTier } from '@/types/database';

interface Props {
  quest: Quest;
  userTier: TrustTier;
}

function canAccept(quest: Quest, tier: TrustTier): { ok: boolean; reason?: string } {
  if (quest.tag === 'food' && tier === 'wanderer')
    return { ok: false, reason: 'Explorer+ required for food quests' };
  if (quest.reward_amount > 5 && tier === 'wanderer')
    return { ok: false, reason: 'Explorer+ required for rewards > $5' };
  return { ok: true };
}

export function QuestCard({ quest, userTier }: Props) {
  const eligibility = canAccept(quest, userTier);
  const deadlineDate = new Date(quest.deadline);
  const expired = isPast(deadlineDate);
  const timeLeft = expired
    ? 'Expired'
    : `${formatDistanceToNow(deadlineDate)} left`;

  const displayTitle = quest.ai_generated_title || quest.title;
  const tagColour = TAG_COLOURS[quest.tag] ?? '#6b7280';
  const tierConfig = TRUST_TIER_CONFIG[userTier];

  // Flash countdown timer
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!quest.is_flash || !quest.flash_expires_at) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [quest.is_flash, quest.flash_expires_at]);

  const flashExpiresAt = quest.flash_expires_at ? new Date(quest.flash_expires_at) : null;
  const flashSecondsLeft = flashExpiresAt
    ? Math.max(0, Math.floor((flashExpiresAt.getTime() - now.getTime()) / 1000))
    : 0;
  const flashMins = Math.floor(flashSecondsLeft / 60);
  const flashSecs = flashSecondsLeft % 60;
  const flashCountdown = `${flashMins}:${String(flashSecs).padStart(2, '0')}`;

  const isFlashExpired =
    quest.is_flash && quest.flash_expires_at && isPast(new Date(quest.flash_expires_at));

  if (isFlashExpired || expired) return null;

  return (
    <Pressable
      onPress={() => router.push(`/quest/${quest.id}`)}
      className="bg-surface-2 rounded-2xl p-4 mb-3 border border-surface-3 shadow-md active:shadow-lg active:opacity-95"
      style={{ opacity: eligibility.ok ? 1 : 0.6 }}
    >
      {/* Flash badge with live countdown */}
      {quest.is_flash && (
        <View className="flex-row items-center gap-2 mb-3">
          <View className="bg-warning/20 border border-warning rounded-full px-2.5 py-1">
            <Text className="text-warning text-xs font-bold">⚡ Flash Quest</Text>
          </View>
          <View className="bg-surface-3 rounded-full px-2.5 py-1 border border-surface-3">
            <Text className="text-warning text-xs font-mono font-semibold">{flashCountdown}</Text>
          </View>
        </View>
      )}

      {/* Tag + fulfilment row */}
      <View className="flex-row items-center gap-2 mb-3 flex-wrap">
        <View
          className="rounded-full px-2.5 py-1"
          style={{ backgroundColor: tagColour + '22' }}
        >
          <Text style={{ color: tagColour }} className="text-xs font-bold">
            {quest.tag.charAt(0).toUpperCase() + quest.tag.slice(1)}
          </Text>
        </View>

        <View className="bg-surface-3 rounded-full px-2.5 py-1 border border-surface-3">
          <Text className="text-muted text-xs font-medium">
            {quest.fulfilment_mode === 'meetup' ? '📍 Meet Up' : '📦 Drop Off'}
          </Text>
        </View>

        {quest.location_name && (
          <Text className="text-muted text-xs flex-1" numberOfLines={1}>
            {quest.location_name}
          </Text>
        )}
      </View>

      {/* Title */}
      <Text className="text-white font-bold text-base mb-2 leading-snug" numberOfLines={2}>
        {displayTitle}
      </Text>

      {/* Description preview */}
      <Text className="text-muted-light text-sm mb-4" numberOfLines={2}>
        {quest.description}
      </Text>

      {/* Bottom row: reward + deadline */}
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-accent-light text-xs font-semibold mb-0.5">Reward</Text>
          <Text className="text-accent font-bold text-lg">
            {quest.reward_amount > 0 ? `$${quest.reward_amount.toFixed(2)}` : 'Favour'}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-muted text-xs mb-0.5">Deadline</Text>
          <Text className="text-muted-light text-xs font-semibold">{timeLeft}</Text>
        </View>
      </View>

      {/* Ineligibility notice */}
      {!eligibility.ok && (
        <View className="mt-3 bg-danger/10 rounded-lg px-3 py-2 border border-danger/20">
          <Text className="text-danger text-xs font-semibold">
            {eligibility.reason} — you are {tierConfig.label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
