import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function Welcome() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-6 pb-12">
      {/* Logo & Tagline */}
      <View className="mb-12 items-center">
        <Text className="text-6xl font-black text-white mb-3">Ripple</Text>
        <Text className="text-muted-light text-lg text-center">
          Small actions. Big community.
        </Text>
        <Text className="text-muted text-sm text-center mt-3 leading-relaxed">
          Connect with your residential college. Post quests, accept challenges, and build trust one small act at a time.
        </Text>
      </View>

      {/* Buttons */}
      <View className="w-full gap-3">
        <Pressable
          className="w-full bg-accent rounded-lg py-4 items-center justify-center shadow-md active:shadow-lg active:opacity-90"
          onPress={() => router.push('/(auth)/sign-up')}
        >
          <Text className="text-white font-bold text-base">Get Started</Text>
        </Pressable>

        <Pressable
          className="w-full border border-accent/30 bg-accent/5 rounded-lg py-4 items-center justify-center active:opacity-80"
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text className="text-accent font-bold text-base">Sign In</Text>
        </Pressable>
      </View>
    </View>
  );
}
