import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function Welcome() {
  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text className="text-4xl font-bold text-white mb-2">Ripple</Text>
      <Text className="text-muted text-center mb-12">Small actions. Big community.</Text>

      <Pressable
        className="w-full bg-accent rounded-2xl py-4 items-center mb-4"
        onPress={() => router.push('/(auth)/sign-up')}
      >
        <Text className="text-white font-semibold text-base">Get Started</Text>
      </Pressable>

      <Pressable
        className="w-full border border-surface-2 rounded-2xl py-4 items-center"
        onPress={() => router.push('/(auth)/sign-in')}
      >
        <Text className="text-white font-semibold text-base">Sign In</Text>
      </Pressable>
    </View>
  );
}
