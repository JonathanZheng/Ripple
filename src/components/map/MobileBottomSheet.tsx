import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { QuestAccordion } from './QuestAccordion';
import type { Quest, Profile } from '@/types/database';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.60;
const SLIDE_IN  = { duration: 280, easing: Easing.out(Easing.cubic) };
const SLIDE_OUT = { duration: 220, easing: Easing.in(Easing.cubic) };

interface MobileBottomSheetProps {
  visible: boolean;
  locationName: string;
  quests: Quest[];
  expandedQuestId: string | null;
  onQuestToggle: (id: string) => void;
  posterProfiles: Record<string, Profile>;
  loadingPosters: Set<string>;
  onClose: () => void;
  userTier: string;
  clusterDistance?: number;
}

export function MobileBottomSheet({
  visible,
  locationName,
  quests,
  expandedQuestId,
  onQuestToggle,
  posterProfiles,
  loadingPosters,
  onClose,
  userTier,
  clusterDistance,
}: MobileBottomSheetProps) {
  const insets = useSafeAreaInsets();
  // translateY = 0 → sheet visible; translateY = SHEET_HEIGHT → off-screen below
  const translateY = useSharedValue(SHEET_HEIGHT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withTiming(0, SLIDE_IN);
    } else {
      translateY.value = withTiming(SHEET_HEIGHT, SLIDE_OUT);
      const t = setTimeout(() => setMounted(false), 240);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 600) {
        translateY.value = withTiming(SHEET_HEIGHT, SLIDE_OUT);
        setTimeout(onClose, 0);
      } else {
        translateY.value = withTiming(0, SLIDE_IN);
      }
    })
    .runOnJS(true);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!mounted) return null;

  return (
    <>
      {/* Scrim */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}
      />

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: SHEET_HEIGHT,
            backgroundColor: '#0f0f14',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
            zIndex: 1001,
          },
          sheetStyle,
        ]}
      >
        {/* Drag handle + header */}
        <GestureDetector gesture={drag}>
          <View style={{ paddingTop: 10, paddingBottom: 14, paddingHorizontal: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1}>
                  {locationName || 'Quest Details'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 3 }}>
                  {quests.length === 0
                    ? 'No open quests here'
                    : `${quests.length} quest${quests.length !== 1 ? 's' : ''} at this location`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={10}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          </View>
        </GestureDetector>

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 90,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
        >
          {quests.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 32 }}>
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>No open quests here yet</Text>
            </View>
          ) : (
            quests.map((quest) => (
              <QuestAccordion
                key={quest.id}
                quest={quest}
                userTier={userTier}
                isExpanded={expandedQuestId === quest.id}
                onToggle={() => onQuestToggle(quest.id)}
                posterProfile={posterProfiles[quest.poster_id] ?? null}
                isLoadingPoster={loadingPosters.has(quest.poster_id)}
                distance={clusterDistance}
              />
            ))
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}
