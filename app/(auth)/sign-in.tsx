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
    <View className="flex-1 bg-background px-6 justify-center">
      {/* Header */}
      <View className="mb-8">
        <Text className="text-4xl font-bold text-white mb-2">Welcome back</Text>
        <Text className="text-muted text-base">Sign in to your Ripple account</Text>
      </View>

      {/* Error message */}
      {error && (
        <View className="bg-danger/15 border border-danger/30 rounded-lg px-4 py-3 mb-6">
          <Text className="text-danger text-sm font-semibold">{error}</Text>
        </View>
      )}

      {/* Email/Display Name Input */}
      <View className="mb-5">
        <Text className="text-muted text-sm font-semibold mb-2">Email or Display Name</Text>
        <TextInput
          className="bg-surface-2 text-white rounded-lg px-4 py-3.5 border border-surface-3 text-base"
          placeholder="you@u.nus.edu or Alex Tan"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
          value={identifier}
          onChangeText={setIdentifier}
          editable={!loading}
        />
      </View>

      {/* Password Input */}
      <View className="mb-6">
        <Text className="text-muted text-sm font-semibold mb-2">Password</Text>
        <TextInput
          className="bg-surface-2 text-white rounded-lg px-4 py-3.5 border border-surface-3 text-base"
          placeholder="••••••••"
          placeholderTextColor="#6b7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />
      </View>

      {/* Sign In Button */}
      <Pressable
        className="bg-accent rounded-lg py-4 items-center justify-center mb-6 shadow-md active:shadow-lg active:opacity-90"
        onPress={handleSignIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="text-white font-bold text-base">Sign In</Text>
        )}
      </Pressable>

      {/* Sign Up Link */}
      <Pressable className="items-center" onPress={() => router.push('/(auth)/sign-up')} disabled={loading}>
        <Text className="text-muted text-sm">
          Don't have an account?{' '}
          <Text className="text-accent font-bold">Sign up</Text>
        </Text>
      </Pressable>
    </View>
  );
}
