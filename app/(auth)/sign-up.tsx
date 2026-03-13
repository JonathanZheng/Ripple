import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { MATRIC_REGEX } from '@/constants';

const RC_OPTIONS = ['Acacia', 'CAPT', 'NUSC', 'RC4', 'RVRC', 'Tembusu', 'UTR'];

export default function SignUp() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 32 }}>
      <Text className="text-3xl font-bold text-white mb-8">Create account</Text>

      {error ? <Text className="text-danger mb-4 text-sm">{error}</Text> : null}

      <Text className="text-muted text-sm mb-1">Display Name</Text>
      <TextInput
        className="bg-surface text-white rounded-xl px-4 py-3 mb-4"
        placeholder="e.g. Alex Tan"
        placeholderTextColor="#6b7280"
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text className="text-muted text-sm mb-1">NUS Email</Text>
      <TextInput
        className="bg-surface text-white rounded-xl px-4 py-3 mb-4"
        placeholder="eXXXXXXX@u.nus.edu"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Text className="text-muted text-sm mb-1">Password</Text>
      <TextInput
        className="bg-surface text-white rounded-xl px-4 py-3 mb-4"
        placeholder="••••••••"
        placeholderTextColor="#6b7280"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Text className="text-muted text-sm mb-1">Matric Number</Text>
      <TextInput
        className="bg-surface text-white rounded-xl px-4 py-3 mb-4"
        placeholder="A0XXXXXXX"
        placeholderTextColor="#6b7280"
        autoCapitalize="characters"
        value={matricNumber}
        onChangeText={setMatricNumber}
      />

      <Text className="text-muted text-sm mb-2">Residential College</Text>
      <View className="flex-row flex-wrap gap-2 mb-6">
        {RC_OPTIONS.map((option) => (
          <Pressable
            key={option}
            className={`px-4 py-2 rounded-full border ${rc === option ? 'bg-accent border-accent' : 'border-surface-2'}`}
            onPress={() => setRc(option)}
          >
            <Text className={rc === option ? 'text-white' : 'text-muted'}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        className="bg-accent rounded-2xl py-4 items-center"
        onPress={handleSignUp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Continue</Text>
        )}
      </Pressable>

      <Pressable className="mt-6 items-center" onPress={() => router.back()}>
        <Text className="text-muted">Already have an account? <Text className="text-accent">Sign in</Text></Text>
      </Pressable>
    </ScrollView>
  );
}
