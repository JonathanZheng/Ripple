import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { Avatar } from '@/components/ui/Avatar';
import { TRUST_TIER_CONFIG } from '@/constants';
import type { Profile, DirectMessage } from '@/types/database';

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
  const listRef = useRef<FlatList>(null);

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
          }
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [recipientId, currentUserId]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !currentUserId || !recipientId || sending) return;

    setInput('');
    setSending(true);

    // Optimistic insert
    const optimistic: DirectMessage = {
      id: `opt-${Date.now()}`,
      sender_id: currentUserId,
      recipient_id: recipientId,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    const { data } = await supabase
      .from('direct_messages')
      .insert({ sender_id: currentUserId, recipient_id: recipientId, content: text })
      .select()
      .single();

    if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? (data as DirectMessage) : m)),
      );
    }
    setSending(false);
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
          contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, justifyContent: 'flex-end' }}
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
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: insets.bottom + 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.07)',
          backgroundColor: '#0a0a0e',
        }}
      >
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
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: input.trim() ? '#3b82f6' : 'rgba(59,130,246,0.22)',
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
