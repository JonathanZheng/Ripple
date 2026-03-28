import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useState } from 'react';
import { router } from 'expo-router';
import { ChevronDown, MapPin, Calendar, ExternalLink, Zap, Lock, Navigation } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { TAG_COLOURS, TRUST_TIER_CONFIG } from '@/constants';
import { isEligible, ineligibilityReason } from '@/lib/ranking';
import type { Quest, Profile, TrustTier } from '@/types/database';

const DETAILS_MAX_HEIGHT = 480; // generous ceiling — content never exceeds this
const ANIM = { duration: 240, easing: Easing.out(Easing.cubic) };

interface QuestAccordionProps {
  quest: Quest;
  userTier: string;
  isExpanded: boolean;
  onToggle: () => void;
  posterProfile: Profile | null;
  isLoadingPoster: boolean;
  distance?: number;
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return 'No deadline';
  const d = new Date(deadline);
  return d.toLocaleString('en-SG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function QuestAccordion({
  quest,
  userTier,
  isExpanded,
  onToggle,
  posterProfile,
  isLoadingPoster,
  distance,
}: QuestAccordionProps) {
  const [showDetails, setShowDetails] = useState(false);
  const eligible = isEligible(quest, userTier as TrustTier);
  const ineligReason = ineligibilityReason(quest, userTier as TrustTier);
  const tierLabel = TRUST_TIER_CONFIG[userTier as TrustTier]?.label ?? userTier;

  // When the accordion collapses, also hide details
  const effectiveShowDetails = isExpanded && showDetails;

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(isExpanded ? '180deg' : '0deg', ANIM) }],
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    height: withTiming(isExpanded ? 66 : 0, ANIM),
    opacity: withTiming(isExpanded ? 1 : 0, ANIM),
    overflow: 'hidden',
  }));

  const detailsStyle = useAnimatedStyle(() => ({
    maxHeight: withTiming(effectiveShowDetails ? DETAILS_MAX_HEIGHT : 0, ANIM),
    opacity: withTiming(effectiveShowDetails ? 1 : 0, ANIM),
    overflow: 'hidden',
  }));

  const tagColor = TAG_COLOURS[quest.tag] || '#7c3aed';

  async function handleAccept() {
    // Navigate to full quest page which handles accept flow
    router.push(`/quest/${quest.id}?from=map`);
  }

  return (
    <View
      style={{
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: eligible ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.18)',
        overflow: 'hidden',
        opacity: eligible ? 1 : 0.55,
      }}
    >
      {/* ── Summary row (always visible) ── */}
      <TouchableOpacity
        onPress={() => {
          if (isExpanded) setShowDetails(false); // reset detail on collapse
          onToggle();
        }}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }}
            numberOfLines={1}
          >
            {quest.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <View
              style={{
                backgroundColor: tagColor + '33',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: tagColor + '88',
              }}
            >
              <Text style={{ color: tagColor, fontSize: 11, fontWeight: '600' }}>{quest.tag}</Text>
            </View>
            <View
              style={{
                backgroundColor: 'rgba(16,185,129,0.15)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: 'rgba(16,185,129,0.4)',
              }}
            >
              <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>
                {quest.reward_amount > 0 ? `$${quest.reward_amount.toFixed(2)}` : 'Favour'}
              </Text>
            </View>
            {quest.is_flash && (
              <View
                style={{
                  backgroundColor: 'rgba(245,158,11,0.15)',
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: 'rgba(245,158,11,0.4)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Zap size={10} color="#f59e0b" fill="#f59e0b" />
                <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '700' }}>FLASH</Text>
              </View>
            )}
            {distance != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Navigation size={10} color="rgba(255,255,255,0.35)" strokeWidth={2} />
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600' }}>
                  {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={20} color="rgba(255,255,255,0.5)" />
        </Animated.View>
      </TouchableOpacity>

      {/* ── Two action buttons (slide in on expand) ── */}
      <Animated.View style={buttonsStyle}>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 14,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.06)',
            paddingTop: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => setShowDetails((v) => !v)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: 9,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              backgroundColor: effectiveShowDetails
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(255,255,255,0.05)',
            }}
            activeOpacity={0.7}
          >
            <ExternalLink size={14} color="rgba(255,255,255,0.8)" />
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' }}>
              {effectiveShowDetails ? 'Hide Details' : 'View Details'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={eligible ? handleAccept : undefined}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: 9,
              backgroundColor: eligible ? '#7c3aed' : 'rgba(255,255,255,0.07)',
              borderWidth: eligible ? 0 : 1,
              borderColor: 'rgba(255,255,255,0.12)',
            }}
            activeOpacity={eligible ? 0.8 : 1}
          >
            {!eligible && <Lock size={12} color="rgba(255,255,255,0.35)" strokeWidth={2.5} />}
            <Text style={{ color: eligible ? '#fff' : 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '700' }}>
              {eligible ? 'Accept Quest' : `Needs ${ineligReason ? ineligReason.split(' ')[0] : 'higher rank'}`}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Inline details section ── */}
      <Animated.View style={detailsStyle}>
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.06)',
          }}
        >
          {/* Description */}
          <Text
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 13,
              lineHeight: 20,
              marginTop: 12,
              marginBottom: 12,
            }}
          >
            {quest.description}
          </Text>

          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />

          {/* Poster */}
          {isLoadingPoster ? (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" style={{ marginBottom: 10 }} />
          ) : posterProfile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: '#7c3aed',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {posterProfile.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>
                {posterProfile.display_name}
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(124,58,237,0.2)',
                  borderRadius: 5,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  borderWidth: 1,
                  borderColor: 'rgba(124,58,237,0.5)',
                }}
              >
                <Text style={{ color: '#a78bfa', fontSize: 10, fontWeight: '700' }}>
                  {posterProfile.trust_tier}
                </Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{posterProfile.rc}</Text>
              {posterProfile.avg_rating > 0 && (
                <Text style={{ color: '#fbbf24', fontSize: 12 }}>
                  ★ {posterProfile.avg_rating.toFixed(1)}
                </Text>
              )}
            </View>
          ) : null}

          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />

          {/* Meta */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {quest.location_name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                  {quest.location_name}
                </Text>
              </View>
            )}
            {quest.deadline && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Calendar size={12} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                  {formatDeadline(quest.deadline)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
 