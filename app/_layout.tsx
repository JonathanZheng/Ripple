import '../src/global.css';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

// Registers Expo push token for the logged-in user.
// Requires: npx expo install expo-notifications + rebuild dev client.
async function registerPushToken(userId: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const token = await Notifications.getExpoPushTokenAsync();
    await supabase.from('profiles').update({ push_token: token.data }).eq('id', userId);
  } catch {
    // expo-notifications not installed yet — safe to ignore
  }
}

function AppShell() {
  const { isDark } = useTheme();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        registerPushToken(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
