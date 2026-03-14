import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function Verify() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handleVerify() {
    if (!imageUri) {
      setError('Please upload a photo of your Student Pass.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Session expired. Please sign up again.');
        return;
      }

      const meta = user.user_metadata as {
        display_name: string;
        matric_number: string;
        rc: string;
      };

      // Upload student pass photo to storage
      const ext = imageUri.split('.').pop() ?? 'jpg';
      const path = `${user.id}.${ext}`;
      const blob = await (await fetch(imageUri)).blob();
      await supabase.storage.from('student-passes').upload(path, blob, { upsert: true });
      // Upload failure is non-fatal — proceed even if bucket doesn't exist yet

      // Create profile row — mock verification accepts any photo upload
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        display_name: meta.display_name,
        matric_number: meta.matric_number,
        rc: meta.rc,
      });

      if (insertError) {
        // code '23505' = unique_violation — profile already exists, safe to proceed
        if (insertError.code !== '23505') {
          setError(insertError.message);
          return;
        }
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
        <Text className="text-4xl font-bold text-white mb-2">Verify your identity</Text>
        <Text className="text-muted text-base">
          Upload a photo of your NUS Student Pass to confirm you're a real student.
        </Text>
      </View>

      {/* Error message */}
      {error && (
        <View className="bg-danger/15 border border-danger/30 rounded-lg px-4 py-3 mb-6">
          <Text className="text-danger text-sm font-semibold">{error}</Text>
        </View>
      )}

      {/* Image upload area */}
      <Pressable
        className="bg-surface-2 border-2 border-dashed border-surface-3 rounded-2xl py-12 items-center justify-center mb-8 active:opacity-80"
        onPress={pickImage}
        disabled={loading}
      >
        {imageUri ? (
          <View className="w-full items-center">
            <Image source={{ uri: imageUri }} className="w-32 h-40 rounded-xl mb-3" resizeMode="contain" />
            <Text className="text-accent font-semibold text-sm">Tap to change photo</Text>
          </View>
        ) : (
          <View className="items-center">
            <Text className="text-5xl mb-3">🪪</Text>
            <Text className="text-white font-semibold text-base mb-1">Upload Student Pass</Text>
            <Text className="text-muted text-sm">Tap to select a photo</Text>
          </View>
        )}
      </Pressable>

      {/* Verify Button */}
      <Pressable
        className="bg-accent rounded-lg py-4 items-center justify-center mb-4 shadow-md active:shadow-lg active:opacity-90"
        onPress={handleVerify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="text-white font-bold text-base">Verify & Enter Ripple</Text>
        )}
      </Pressable>

      {/* Info text */}
      <Text className="text-muted text-xs text-center">
        Your photo is securely stored and only used for verification purposes.
      </Text>
    </View>
  );
}
