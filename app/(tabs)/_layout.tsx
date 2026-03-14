import { Tabs, Redirect } from 'expo-router';
import { useSession } from '@/hooks/useSession';
import { View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  Trophy,
  Layers,
  Plus,
  User,
  Settings,
} from 'lucide-react-native';

const TABS = [
  { name: 'map',        label: 'Ranks',   icon: Trophy  },
  { name: 'feed',       label: 'Feed',    icon: Layers  },
  { name: 'post-quest', label: 'Post',    icon: Plus,   isAction: true },
  { name: 'profile',    label: 'Profile', icon: User    },
  { name: 'settings',   label: 'More',    icon: Settings },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabItem({
  tab,
  isActive,
  onPress,
}: {
  tab: typeof TABS[number];
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const Icon = tab.icon;

  if (tab.isAction) {
    return (
      <AnimatedPressable
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
        onPress={onPress}
        style={[animStyle, { alignItems: 'center', justifyContent: 'center' }]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#7c3aed',
            shadowColor: '#7c3aed',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.50,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Icon size={20} color="#ffffff" strokeWidth={2.5} />
        </View>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.92, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      onPress={onPress}
      style={[
        animStyle,
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
          minWidth: 54,
          gap: 3,
        },
      ]}
    >
      <Icon
        size={18}
        color={isActive ? '#ffffff' : 'rgba(255,255,255,0.40)'}
        strokeWidth={isActive ? 2.2 : 1.8}
      />
      <Text
        style={{
          fontSize: 10,
          fontWeight: isActive ? '600' : '400',
          color: isActive ? '#ffffff' : 'rgba(255,255,255,0.40)',
          letterSpacing: 0.2,
        }}
      >
        {tab.label}
      </Text>
    </AnimatedPressable>
  );
}

function FloatingTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = TABS.find(t => pathname.includes(t.name))?.name ?? 'feed';

  return (
    <View
      style={{
        position: 'absolute',
        bottom: insets.bottom + 16,
        left: 20,
        right: 20,
        alignItems: 'center',
        pointerEvents: 'box-none',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          backgroundColor: 'rgba(10,10,10,0.92)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          borderRadius: 24,
          paddingHorizontal: 8,
          paddingVertical: 6,
          width: '100%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 24,
          elevation: 20,
        }}
      >
        {TABS.map(tab => (
          <TabItem
            key={tab.name}
            tab={tab}
            isActive={activeTab === tab.name}
            onPress={() => router.push(`/(tabs)/${tab.name}` as any)}
          />
        ))}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { session, loading } = useSession();

  if (!loading && !session) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="map" />
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="post-quest" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <FloatingTabBar />
    </View>
  );
}
