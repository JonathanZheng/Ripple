import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { MATRIC_REGEX } from '@/constants';

const RC_OPTIONS = ['Acacia', 'CAPT', 'NUSC', 'RC4', 'RVRC', 'Tembusu', 'UTR'];

export default function SignUp() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [rc, setRc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignUp() {
    setError('');
    if (!displayName || !email || !password || !matricNumber || !rc) {
      setError('All fields are required.');
      return;
    }
    if (!MATRIC_REGEX.test(matricNumber)) {
      setError('Matric number format is invalid (e.g. A0123456X).');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Store profile data in user metadata so verify screen can read it
          data: { display_name: displayName, matric_number: matricNumber, rc },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      router.push('/(auth)/verify');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 40 }}>
      {/* Header */}
      <View className="mb-8">
        <Text className="text-4xl font-bold text-white mb-2">Create account</Text>
        <Text className="text-muted text-base">Join Ripple and start helping</Text>
      </View>

      {/* Error message */}
      {error && (
        <View className="bg-danger/15 border border-danger/30 rounded-lg px-4 py-3 mb-6">
          <Text className="text-danger text-sm font-semibold">{error}</Text>
        </View>
      )}

      {/* Display Name Input */}
      <View className="mb-5">
        <Text className="text-muted text-sm font-semibold mb-2">Display Name</Text>
        <TextInput
          className="bg-surface-2 text-white rounded-lg px-4 py-3.5 border border-surface-3 text-base"
          placeholder="e.g. Alex Tan"
          placeholderTextColor="#6b7280"
          value={displayName}
          onChangeText={setDisplayName}
          editable={!loading}
        />
      </View>

      {/* NUS Email Input */}
      <View className="mb-5">
        <Text className="text-muted text-sm font-semibold mb-2">NUS Email</Text>
        <TextInput
          className="bg-surface-2 text-white rounded-lg px-4 py-3.5 border border-surface-3 text-base"
          placeholder="eXXXXXXX@u.nus.edu"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
      </View>

      {/* Password Input */}
      <View className="mb-5">
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

      {/* Confirm Password Input */}
      <View className="mb-5">
        <Text className="text-muted text-sm font-semibold mb-2">Confirm Password</Text>
        <TextInput
          className="bg-surface-2 text-white rounded-lg px-4 py-3.5 border border-surface-3 text-base"
          placeholder="••••••••"
          placeholderTextColor="#6b7280"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!loading}
        />
      </View>

      {/* Matric Number Input */}
      <View className="mb-5">
        <Text className="text-muted text-sm font-semibold mb-2">Matric Number</Text>
        <TextInput
          className="bg-surface-2 text-white rounded-lg px-4 py-3.5 border border-surface-3 text-base"
          placeholder="A0XXXXXXX"
          placeholderTextColor="#6b7280"
          autoCapitalize="characters"
          value={matricNumber}
          onChangeText={setMatricNumber}
          editable={!loading}
        />
      </View>

      {/* Residential College Selection */}
      <View className="mb-6">
        <Text className="text-muted text-sm font-semibold mb-3">Residential College</Text>
        <View className="flex-row flex-wrap gap-2">
          {RC_OPTIONS.map((option) => (
            <Pressable
              key={option}
              className={`px-4 py-2 rounded-lg border transition-all ${
                rc === option
                  ? 'bg-accent border-accent shadow-accent-sm'
                  : 'border-surface-3 bg-surface-2'
              }`}
              onPress={() => setRc(option)}
              disabled={loading}
            >
              <Text className={`text-sm font-semibold ${rc === option ? 'text-white' : 'text-muted'}`}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Sign Up Button */}
      <Pressable
        className="bg-accent rounded-lg py-4 items-center justify-center mb-6 shadow-md active:shadow-lg active:opacity-90"
        onPress={handleSignUp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="text-white font-bold text-base">Create Account</Text>
        )}
      </Pressable>

      {/* Sign In Link */}
      <Pressable className="items-center" onPress={() => router.back()} disabled={loading}>
        <Text className="text-muted text-sm">
          Already have an account?{' '}
          <Text className="text-accent font-bold">Sign in</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}
