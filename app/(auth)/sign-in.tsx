import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [identifier, setIdentifier] = useState(''); // email or display name
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn() {
    setError('');
    if (!identifier || !password) {
      setError('Please enter your email or display name, and your password.');
      return;
    }

    setLoading(true);
    try {
      let email = identifier.trim();

      // If it doesn't look like an email, look up by display name
      if (!email.includes('@')) {
        const { data, error: rpcError } = await supabase.rpc('get_email_by_display_name', {
          p_display_name: email,
        });
        if (rpcError || !data) {
          setError('No account found with that display name.');
          return;
        }
        email = data as string;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.replace('/(tabs)/feed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background px-8 justify-center">
      <Text className="text-3xl font-bold text-white mb-8">Welcome back</Text>

      {error ? <Text className="text-danger mb-4 text-sm">{error}</Text> : null}

      <Text className="text-muted text-sm mb-1">Email or Display Name</Text>
      <TextInput
        className="bg-surface text-white rounded-xl px-4 py-3 mb-4"
        placeholder="you@u.nus.edu or Alex Tan"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        autoCorrect={false}
        value={identifier}
        onChangeText={setIdentifier}
      />

      <Text className="text-muted text-sm mb-1">Password</Text>
      <TextInput
        className="bg-surface text-white rounded-xl px-4 py-3 mb-6"
        placeholder="••••••••"
        placeholderTextColor="#6b7280"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        className="bg-accent rounded-2xl py-4 items-center"
        onPress={handleSignIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Sign In</Text>
        )}
      </Pressable>

      <Pressable className="mt-6 items-center" onPress={() => router.push('/(auth)/sign-up')}>
        <Text className="text-muted">Don't have an account? <Text className="text-accent">Sign up</Text></Text>
      </Pressable>
    </View>
  );
}
