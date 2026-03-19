import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send, MapPin, Navigation2 } from 'lucide-react-native';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { Avatar } from '@/components/ui/Avatar';
import { TRUST_TIER_CONFIG } from '@/constants';
import type { Profile, DirectMessage } from '@/types/database';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatCoords(lat: number, lng: number) {
  return `${Math.abs(lat).toFixed(5)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lng).toFixed(5)}°${lng >= 0 ? 'E' : 'W'}`;
}

// ─── location bubble ────────────────────────────────────────────────────────

function LocationBubble({
  lat,
  lng,
  isMe,
  onPress,
}: {
  lat: number;
  lng: number;
  isMe: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        maxWidth: '72%',
        borderRadius: 18,
        borderBottomRightRadius: isMe ? 4 : 18,
        borderBottomLeftRadius: isMe ? 18 : 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isMe ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.12)',
      }}
    >
      {/* Map preview strip */}
      <View
        style={{
          height: 80,
          backgroundColor: isMe ? '#1e3a5f' : 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Grid lines to suggest a map */}
        {[0.25, 0.5, 0.75].map((v) => (
          <View
            key={`h${v}`}
            style={{
              position: 'absolute',
              left: 0, right: 0,
              top: `${v * 100}%`,
              height: 1,
              backgroundColor: isMe ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.07)',
            }}
          />
        ))}
        {[0.25, 0.5, 0.75].map((v) => (
          <View
            key={`v${v}`}
            style={{
              position: 'absolute',
              top: 0, bottom: 0,
              left: `${v * 100}%`,
              width: 1,
              backgroundColor: isMe ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.07)',
            }}
          />
        ))}
        {/* Pin */}
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isMe ? '#3b82f6' : 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <MapPin size={16} color="#fff" strokeWidth={2.5} />
          </View>
          {/* Pin tail */}
          <View
            style={{
              width: 2,
              height: 6,
              backgroundColor: isMe ? '#3b82f6' : 'rgba(255,255,255,0.4)',
              marginTop: -1,
            }}
          />
        </View>
      </View>

      {/* Label row */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          backgroundColor: isMe ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.05)',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
            Shared location
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 11,
              marginTop: 2,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatCoords(lat, lng)}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: isMe ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.10)',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
          }}
        >
          <Navigation2 size={11} color={isMe ? '#93c5fd' : 'rgba(255,255,255,0.6)'} />
          <Text
            style={{
              color: isMe ? '#93c5fd' : 'rgba(255,255,255,0.6)',
              fontSize: 11,
              fontWeight: '600',
            }}
          >
            Open map
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── screen ─────────────────────────────────────────────────────────────────

export default function DMScreen() {
  const { userId: recipientId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useSession();
  const currentUserId = session?.user?.id;
  const insets = useSafeAreaInsets();

  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const listRef = useRef<FlatList>(null);

  // ── load profile + message history ────────────────────────────────────────
  useEffect(() => {
    if (!recipientId || !currentUserId) return;

    async function load() {
      const [profileRes, msgsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', recipientId).single(),
        supabase
          .from('direct_messages')
          .select('*')
          .in('sender_id', [currentUserId!, recipientId])
          .in('recipient_id', [currentUserId!, recipientId])
          .order('created_at', { ascending: true }),
      ]);
      if (profileRes.data) setRecipient(profileRes.data as Profile);
      if (msgsRes.data) setMessages(msgsRes.data as DirectMessage[]);
      setLoading(false);
    }
    load();
  }, [recipientId, currentUserId]);

  // ── real-time subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!recipientId || !currentUserId) return;

    const channel = supabase
      .channel(`dm:${[currentUserId, recipientId].sort().join(':')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const msg = payload.new as DirectMessage;
          if (msg.sender_id === recipientId) {
            setMessages((prev) => [...prev, msg]);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
          }
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [recipientId, currentUserId]);

  // ── send text ──────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || !currentUserId || !recipientId || sending) return;

    setInput('');
    setSending(true);

    const optimistic: DirectMessage = {
      id: `opt-${Date.now()}`,
      sender_id: currentUserId,
      recipient_id: recipientId,
      content: text,
      message_type: 'text',
      latitude: null,
      longitude: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    const { data } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: currentUserId,
        recipient_id: recipientId,
        content: text,
        message_type: 'text',
      })
      .select()
      .single();

    if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? (data as DirectMessage) : m)),
      );
    }
    setSending(false);
  }

  // ── send location ──────────────────────────────────────────────────────────
  async function sendLocation() {
    if (!currentUserId || !recipientId || sendingLocation) return;

    setSendingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location access needed',
          'Allow location access in Settings to share your position.',
        );
        setSendingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;

      const optimistic: DirectMessage = {
        id: `opt-loc-${Date.now()}`,
        sender_id: currentUserId,
        recipient_id: recipientId,
        content: '',
        message_type: 'location',
        latitude,
        longitude,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

      const { data } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: currentUserId,
          recipient_id: recipientId,
          content: '',
          message_type: 'location',
          latitude,
          longitude,
        })
        .select()
        .single();

      if (data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? (data as DirectMessage) : m)),
        );
      }
    } catch {
      Alert.alert('Could not get location', 'Please try again.');
    } finally {
      setSendingLocation(false);
    }
  }

  // ── open shared location on map ────────────────────────────────────────────
  function openLocationOnMap(lat: number, lng: number, label?: string) {
    router.push({
      pathname: '/(tabs)/map',
      params: {
        focusLat: lat.toString(),
        focusLng: lng.toString(),
        focusLabel: label ?? 'Shared location',
      },
    });
  }

  const tierConfig = recipient ? TRUST_TIER_CONFIG[recipient.trust_tier] : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0a0a0e' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.07)',
          backgroundColor: '#0a0a0e',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="rgba(255,255,255,0.70)" />
        </TouchableOpacity>
        {recipient && (
          <>
            <Avatar name={recipient.display_name} size="sm" tierColor={tierConfig?.colour} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                {recipient.display_name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12 }}>
                {recipient.rc}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="rgba(255,255,255,0.30)" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            gap: 8,
            flexGrow: 1,
            justifyContent: 'flex-end',
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ color: 'rgba(255,255,255,0.20)', fontSize: 14 }}>
                Say hi to {recipient?.display_name ?? '…'}!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.sender_id === currentUserId;

            // ── location message ─────────────────────────────────────────
            if (
              item.message_type === 'location' &&
              item.latitude != null &&
              item.longitude != null
            ) {
              return (
                <LocationBubble
                  lat={item.latitude}
                  lng={item.longitude}
                  isMe={isMe}
                  onPress={() =>
                    openLocationOnMap(
                      item.latitude!,
                      item.longitude!,
                      isMe ? 'Your location' : recipient?.display_name,
                    )
                  }
                />
              );
            }

            // ── text message ─────────────────────────────────────────────
            return (
              <View
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  backgroundColor: isMe ? '#3b82f6' : 'rgba(255,255,255,0.09)',
                  borderRadius: 18,
                  borderBottomRightRadius: isMe ? 4 : 18,
                  borderBottomLeftRadius: isMe ? 18 : 4,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>
                  {item.content}
                </Text>
              </View>
            );
          }}
        />
      )}

      {/* Input bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: insets.bottom + 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.07)',
          backgroundColor: '#0a0a0e',
        }}
      >
        {/* Location pin button */}
        <TouchableOpacity
          onPress={sendLocation}
          disabled={sendingLocation}
          hitSlop={8}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            borderWidth: 1,
            borderColor: sendingLocation
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.14)',
            backgroundColor: sendingLocation
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(18,18,20,0.72)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          activeOpacity={0.7}
        >
          {sendingLocation ? (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.35)" />
          ) : (
            <MapPin size={17} color="rgba(255,255,255,0.55)" strokeWidth={2} />
          )}
        </TouchableOpacity>

        {/* Text input */}
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
            maxHeight: 120,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={{ color: '#fff', fontSize: 15 }}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            multiline
          />
        </View>

        {/* Send button */}
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: input.trim()
              ? '#3b82f6'
              : 'rgba(59,130,246,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          activeOpacity={0.8}
        >
          <Send size={17} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
} 