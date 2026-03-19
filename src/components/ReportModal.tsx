import { View, Text, Modal, ScrollView, TextInput, Pressable, Alert, Platform } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { REPORT_TYPES } from '@/constants';
import { useTheme } from '@/lib/ThemeContext';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react-native';
import type { ReportType } from '@/types/database';

const REPORT_LABELS: Record<ReportType, string> = {
  inappropriate_content: 'Inappropriate Content',
  harassment: 'Harassment',
  dispute: 'Dispute / Non-payment',
  other: 'Other',
};

interface ReportModalProps {
  visible: boolean;
  reportedUserId: string | null;
  questId?: string | null;
  onClose: () => void;
}

export function ReportModal({ visible, reportedUserId, questId, onClose }: ReportModalProps) {
  const { session } = useSession();
  const { colors } = useTheme();
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setSelectedType(null);
    setDescription('');
    setSubmitting(false);
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (!selectedType || !session?.user?.id) return;
    setSubmitting(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: session.user.id,
      reported_user_id: reportedUserId ?? undefined,
      quest_id: questId ?? undefined,
      report_type: selectedType,
      description: description.trim() || undefined,
    });
    setSubmitting(false);
    if (error) {
      if (Platform.OS === 'web') window.alert('Failed to submit report.');
      else Alert.alert('Error', 'Failed to submit report.');
      return;
    }
    setSubmitted(true);
    setTimeout(() => {
      reset();
      onClose();
    }, 1500);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.70)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: '#1a1a1a',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: '80%',
          }}
          onPress={() => {}} // prevent close on content tap
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.4 }}>
              Report User
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={colors.textFaint} strokeWidth={2} />
            </Pressable>
          </View>

          {submitted ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '700' }}>
                Report submitted
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 14, marginTop: 6 }}>
                Our team will review it shortly.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 }}>
                REASON
              </Text>
              <View style={{ gap: 8, marginBottom: 20 }}>
                {(REPORT_TYPES as readonly ReportType[]).map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setSelectedType(type)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: selectedType === type ? '#7c3aed' : colors.border,
                      backgroundColor: selectedType === type ? 'rgba(124,58,237,0.10)' : colors.surface2,
                    }}
                  >
                    <Text style={{
                      color: selectedType === type ? '#a78bfa' : colors.text,
                      fontSize: 14,
                      fontWeight: selectedType === type ? '600' : '400',
                    }}>
                      {REPORT_LABELS[type]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
                ADDITIONAL DETAILS (OPTIONAL)
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe what happened..."
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={500}
                style={{
                  backgroundColor: colors.surface2,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 14,
                  color: colors.text,
                  fontSize: 14,
                  minHeight: 90,
                  textAlignVertical: 'top',
                  marginBottom: 20,
                }}
              />

              <Button
                variant="danger"
                size="lg"
                loading={submitting}
                disabled={!selectedType}
                onPress={handleSubmit}
                style={{ width: '100%' }}
              >
                Submit Report
              </Button>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
