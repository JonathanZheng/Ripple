import { View, Text, Pressable, Image } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, Upload, CheckCircle, Info } from 'lucide-react-native';

export default function Verify() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setError('');
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

      const ext = imageUri.split('.').pop() ?? 'jpg';
      const path = `${user.id}.${ext}`;
      const blob = await (await fetch(imageUri)).blob();
      await supabase.storage.from('student-passes').upload(path, blob, { upsert: true });

      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        display_name: meta.display_name,
        matric_number: meta.matric_number,
        rc: meta.rc,
      });

      if (insertError && insertError.code !== '23505') {
        setError(insertError.message);
        return;
      }

      router.replace('/(tabs)/feed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, justifyContent: 'center' }}>
      {/* Back */}
      <Pressable
        onPress={() => router.back()}
        style={{ marginBottom: 32, alignSelf: 'flex-start', padding: 4, marginLeft: -4 }}
        hitSlop={12}
      >
        <ChevronLeft size={22} color="rgba(255,255,255,0.60)" strokeWidth={2} />
      </Pressable>

      {/* Header */}
      <View style={{ marginBottom: 32 }}>
        <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '700', letterSpacing: -0.8, marginBottom: 8 }}>
          Verify your identity
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 22 }}>
          Upload a photo of your NUS Student Pass to confirm you're a real student.
        </Text>
      </View>

      {/* Error */}
      {error ? (
        <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', borderRadius: 14, padding: 14, marginBottom: 20 }}>
          <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '500' }}>{error}</Text>
        </View>
      ) : null}

      {/* Upload area */}
      <Pressable
        onPress={pickImage}
        disabled={loading}
        style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: imageUri ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)',
          borderRadius: 20,
          paddingVertical: 44,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          position: 'relative',
        }}
      >
        {imageUri ? (
          <View style={{ alignItems: 'center' }}>
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: imageUri }} style={{ width: 120, height: 150, borderRadius: 12 }} resizeMode="contain" />
              <View style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#10b981', borderRadius: 999, padding: 3 }}>
                <CheckCircle size={16} color="#ffffff" strokeWidth={2.5} />
              </View>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 13, marginTop: 14 }}>Tap to change</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
              <Upload size={24} color="rgba(255,255,255,0.50)" strokeWidth={1.8} />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}>Upload Student Pass</Text>
            <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13 }}>Tap to select a photo</Text>
          </View>
        )}
      </Pressable>

      {/* Info callout */}
      <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 28, padding: 14 }}>
        <Info size={16} color="rgba(255,255,255,0.40)" strokeWidth={2} style={{ marginTop: 1 }} />
        <Text style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, flex: 1, lineHeight: 19 }}>
          Your photo is securely stored and only used for student verification purposes.
        </Text>
      </Card>

      {/* CTA */}
      <Button
        variant="primary"
        size="lg"
        loading={loading}
        onPress={handleVerify}
        style={{ width: '100%' }}
      >
        Verify identity
      </Button>
    </View>
  );
}
