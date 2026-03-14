import { View, Text } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { formatDistanceToNow, isPast } from 'date-fns';
import { TAG_COLOURS, TRUST_TIER_CONFIG } from '@/constants';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Zap, Clock, MapPin } from 'lucide-react-native';
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

function FlashCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const secondsLeft = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 1000));
  const totalSeconds = 30 * 60;
  const progress = secondsLeft / totalSeconds;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const urgent = secondsLeft < 300;

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Zap size={13} color="#f59e0b" strokeWidth={2.5} />
        <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
          FLASH QUEST
        </Text>
        <View style={{ backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: urgent ? '#ef4444' : '#f59e0b', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {mins}:{String(secs).padStart(2, '0')}
          </Text>
        </View>
      </View>
      <ProgressBar progress={progress} color={urgent ? '#ef4444' : '#f59e0b'} height={2} />
    </View>
  );
}

export function QuestCard({ quest, userTier }: Props) {
  const eligibility = canAccept(quest, userTier);
  const deadlineDate = new Date(quest.deadline);
  const expired = isPast(deadlineDate);
  const timeLeft = expired ? 'Expired' : `${formatDistanceToNow(deadlineDate)} left`;

  const displayTitle = quest.ai_generated_title || quest.title;
  const tierConfig = TRUST_TIER_CONFIG[userTier];

  const flashExpiresAt = quest.flash_expires_at;
  const isFlashExpired = quest.is_flash && flashExpiresAt && isPast(new Date(flashExpiresAt));

  if (isFlashExpired || expired) return null;

  return (
    <Card
      onPress={() => router.push(`/quest/${quest.id}`)}
      style={{ marginBottom: 10, opacity: eligibility.ok ? 1 : 0.55 }}
    >
      {/* Flash countdown */}
      {quest.is_flash && flashExpiresAt && (
        <FlashCountdown expiresAt={flashExpiresAt} />
      )}

      {/* Tag + mode + location row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <Badge variant="tag" value={quest.tag} />
        <Badge variant="mode" value={quest.fulfilment_mode} />
        {quest.location_name && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
            <MapPin size={11} color="rgba(255,255,255,0.30)" strokeWidth={2} />
            <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 11 }} numberOfLines={1}>
              {quest.location_name}
            </Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        style={{ color: '#ffffff', fontWeight: '700', fontSize: 15, marginBottom: 6, letterSpacing: -0.3, lineHeight: 21 }}
        numberOfLines={2}
      >
        {displayTitle}
      </Text>

      {/* Description */}
      <Text
        style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 19, marginBottom: 16 }}
        numberOfLines={2}
      >
        {quest.description}
      </Text>

      {/* Bottom row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Reward */}
        <View
          style={{
            backgroundColor: 'rgba(124,58,237,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(124,58,237,0.25)',
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: '#a78bfa', fontSize: 14, fontWeight: '700', letterSpacing: -0.3 }}>
            {quest.reward_amount > 0 ? `$${quest.reward_amount.toFixed(2)}` : 'Favour'}
          </Text>
        </View>

        {/* Deadline */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Clock size={12} color="rgba(255,255,255,0.30)" strokeWidth={2} />
          <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: '500' }}>
            {timeLeft}
          </Text>
        </View>
      </View>

      {/* Ineligibility notice */}
      {!eligibility.ok && (
        <View
          style={{
            marginTop: 12,
            backgroundColor: 'rgba(239,68,68,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.20)',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '500' }}>
            {eligibility.reason} — you are {tierConfig.label}
          </Text>
        </View>
      )}
    </Card>
  );
}
