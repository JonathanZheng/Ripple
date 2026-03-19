import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useSession } from '@/hooks/useSession';

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f14', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#6c63ff" />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)/feed' : '/(auth)'} />;
}
 