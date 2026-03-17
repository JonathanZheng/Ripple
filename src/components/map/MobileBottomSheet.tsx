import { View, Text, ScrollView, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuestAccordion } from './QuestAccordion';
import type { Quest, Profile } from '@/types/database';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SNAP_CLOSED = SCREEN_HEIGHT;
const SNAP_OPEN = SCREEN_HEIGHT * 0.55;

interface MobileBottomSheetProps {
  visible: boolean;
  quests: Quest[];
  expandedQuestId: string | null;
  onQuestToggle: (id: string) => void;
  posterProfiles: Record<string, Profile>;
  loadingPosters: Set<string>;
  onClose: () => void;
  userTier: string;
}

export function MobileBottomSheet({
  visible,
  quests,
  expandedQuestId,
  onQuestToggle,
  posterProfiles,
  loadingPosters,
  onClose,
  userTier,
}: MobileBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(visible ? 0 : SNAP_CLOSED);

  // Sync with visible prop
  if (visible && translateY.value === SNAP_CLOSED) {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
  } else if (!visible && translateY.value !== SNAP_CLOSED) {
    translateY.value = withSpring(SNAP_CLOSED, { damping: 20, stiffness: 200 });
  }

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 80) {
        runOnJS(onClose)();
        translateY.value = withSpring(SNAP_CLOSED);
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: SNAP_CLOSED,
          backgroundColor: 'rgba(15,15,15,0.97)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          zIndex: 2000,
          paddingTop: 8,
        },
        animatedStyle,
      ]}
    >
      {/* Drag Handle */}
      <GestureDetector gesture={pan}>
        <View style={{ alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 }}>
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.25)',
              marginBottom: 12,
            }}
          />
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>
            {quests.length > 1 ? `${quests.length} Quests Here` : 'Quest Details'}
          </Text>
          {quests.length > 1 && (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
              Multiple tasks at this location
            </Text>
          )}
        </View>
      </GestureDetector>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 80,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {quests.map((quest) => (
          <QuestAccordion
            key={quest.id}
            quest={quest}
            userTier={userTier}
            isExpanded={expandedQuestId === quest.id}
            onToggle={() => onQuestToggle(quest.id)}
            posterProfile={posterProfiles[quest.poster_id] ?? null}
            isLoadingPoster={loadingPosters.has(quest.poster_id)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}
