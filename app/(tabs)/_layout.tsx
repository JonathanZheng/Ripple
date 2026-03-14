import { Tabs, Redirect } from 'expo-router';
import { useSession } from '@/hooks/useSession';

export default function TabsLayout() {
  const { session, loading } = useSession();

  if (!loading && !session) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a24',
          borderTopColor: '#24243a',
          paddingBottom: 6,
          height: 60,
        },
        tabBarActiveTintColor: '#6c63ff',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="map" options={{ title: 'Leaderboard' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="post-quest" options={{ title: 'Post' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
