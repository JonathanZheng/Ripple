import { View, Text } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { formatDistanceToNow, isPast } from 'date-fns';
import { TAG_COLOURS, TRUST_TIER_CONFIG } from '@/constants';
import { isEligible, ineligibilityReason } from '@/lib/ranking';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTheme } from '@/lib/ThemeContext';
import { Zap, Clock, MapPin, Users, Navigation2, Navigation } from 'lucide-react-native';
import type { Quest, TrustTier } from '@/types/database';

interface Props {
  quest: Quest;
  userTier: TrustTier;
  from?: string;
  isOnYourWay?: boolean;
  distance?: number;
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

export function QuestCard({ quest, userTier, from, isOnYourWay, distance }: Props) {
  const eligible = isEligible(quest, userTier);
  const ineligReason = ineligibilityReason(quest, userTier);
  const deadlineDate = new Date(quest.deadline);
  const expired = isPast(deadlineDate);
  const timeLeft = expired ? 'Expired' : `${formatDistanceToNow(deadlineDate)} left`;
  const { colors } = useTheme();

  const displayTitle = quest.ai_generated_title || quest.title;
  const tierConfig = TRUST_TIER_CONFIG[userTier];

  const flashExpiresAt = quest.flash_expires_at;
  const isFlashExpired = quest.is_flash && flashExpiresAt && isPast(new Date(flashExpiresAt));

  const questType = (quest as any).quest_type as string | undefined;
  const maxAcceptors = (quest as any).max_acceptors as number | undefined;
  const isSocial = questType === 'social';
  const isCrew = questType === 'crew';

  if (isFlashExpired || expired) return null;

  const borderColor = quest.is_flash
    ? '#f59e0b'
    : (TAG_COLOURS as Record<string, string>)[quest.tag] ?? 'rgba(255,255,255,0.07)';

  return (
    <Card
      onPress={() => router.push(`/quest/${quest.id}${from ? `?from=${from}` : ''}`)}
      style={{ marginBottom: 10, opacity: eligible ? 1 : 0.55, borderColor, borderWidth: 1.5 }}
    >
      {/* Flash countdown */}
      {quest.is_flash && flashExpiresAt && (
        <FlashCountdown expiresAt={flashExpiresAt} />
      )}

      {/* Tag + mode + quest type + location row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <Badge variant="tag" value={quest.tag} />
        <Badge variant="mode" value={quest.fulfilment_mode} />
        {isSocial && (
          <View style={{
            backgroundColor: 'rgba(217,70,239,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(217,70,239,0.30)',
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
            <Text style={{ color: '#d946ef', fontSize: 11, fontWeight: '600' }}>Social</Text>
          </View>
        )}
        {isCrew && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(96,165,250,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(96,165,250,0.30)',
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
            <Users size={10} color="#60a5fa" strokeWidth={2} />
            <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '600' }}>
              Crew ({maxAcceptors ?? 2} slots)
            </Text>
          </View>
        )}
        {isOnYourWay && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(59,130,246,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(59,130,246,0.30)',
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
            <Navigation2 size={10} color="#3b82f6" strokeWidth={2} />
            <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: '600' }}>On your way</Text>
          </View>
        )}
        {(quest.location_name || distance != null) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
            {quest.location_name && (
              <>
                <MapPin size={11} color={colors.textFaint} strokeWidth={2} />
                <Text style={{ color: colors.textFaint, fontSize: 11 }} numberOfLines={1}>
                  {quest.location_name}
                </Text>
              </>
            )}
            {distance != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: quest.location_name ? 6 : 0 }}>
                <Navigation size={11} color={colors.textFaint} strokeWidth={2} />
                <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '600' }}>
                  {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 6, letterSpacing: -0.3, lineHeight: 21 }}
        numberOfLines={2}
      >
        {displayTitle}
      </Text>

      {/* Description */}
      <Text
        style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 }}
        numberOfLines={2}
      >
        {quest.description}
      </Text>

      {/* Bottom row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Reward / Social label */}
        {isSocial ? (
          <View style={{
            backgroundColor: 'rgba(217,70,239,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(217,70,239,0.20)',
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}>
            <Text style={{ color: '#d946ef', fontSize: 13, fontWeight: '700' }}>Social Quest</Text>
          </View>
        ) : (
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
        )}

        {/* Deadline */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Clock size={12} color={colors.textFaint} strokeWidth={2} />
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '500' }}>
            {timeLeft}
          </Text>
        </View>
      </View>

      {/* Ineligibility notice */}
      {!eligible && ineligReason && (
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
            {ineligReason} — you are {tierConfig.label}
          </Text>
        </View>
      )}
    </Card>
  );
}
 