import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function QuestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text className="text-white text-xl font-semibold">Quest Detail</Text>
      <Text className="text-muted mt-2">Quest ID: {id}</Text>
      <Text className="text-muted mt-1">Coming in Stage 6</Text>
    </View>
  );
}
