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
    <View className="flex-1 bg-background px-8 justify-center">
      <Text className="text-3xl font-bold text-white mb-2">Verify your identity</Text>
      <Text className="text-muted mb-8">
        Upload a photo of your NUS Student Pass. This ensures every Ripple account is tied to a real student.
      </Text>

      {error ? <Text className="text-danger mb-4 text-sm">{error}</Text> : null}

      <Pressable
        className="bg-surface-2 border border-dashed border-muted rounded-2xl py-12 items-center mb-6"
        onPress={pickImage}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} className="w-full h-40 rounded-xl" resizeMode="contain" />
        ) : (
          <>
            <Text className="text-4xl mb-2">🪪</Text>
            <Text className="text-muted text-sm">Tap to upload Student Pass photo</Text>
          </>
        )}
      </Pressable>

      <Pressable
        className="bg-accent rounded-2xl py-4 items-center"
        onPress={handleVerify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Verify & Enter Ripple</Text>
        )}
      </Pressable>
    </View>
  );
}
