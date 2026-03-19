import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { useTheme } from '@/lib/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Flag, AlertCircle } from 'lucide-react-native';
import type { Report, ReportType, ReportStatus } from '@/types/database';

const REPORT_LABELS: Record<ReportType, string> = {
  inappropriate_content: 'Inappropriate Content',
  harassment: 'Harassment',
  dispute: 'Dispute / Non-payment',
  other: 'Other',
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: '#f59e0b',
  reviewed: '#60a5fa',
  resolved: '#10b981',
  dismissed: '#6b7280',
};

interface ReportWithProfile extends Report {
  reported_profiles?: { display_name: string } | null;
}

export default function MyReports() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { colors } = useTheme();
  const [reports, setReports] = useState<ReportWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user?.id) return;
      async function load() {
        setLoading(true);
        const { data } = await supabase
          .from('reports')
          .select('*')
          .eq('reporter_id', session!.user.id)
          .order('created_at', { ascending: false });
        if (data) setReports(data as ReportWithProfile[]);
        setLoading(false);
      }
      load();
    }, [session?.user?.id])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="My Reports"
        backAction
        onBack={() => router.navigate('/(tabs)/settings' as any)}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}>
        {loading ? (
          <ActivityIndicator color="rgba(255,255,255,0.30)" style={{ marginTop: 60 }} />
        ) : reports.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
            <Flag size={40} color="rgba(255,255,255,0.08)" strokeWidth={1.5} />
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
              You haven't submitted any reports
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            {reports.map((report) => (
              <Card key={report.id}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: 'rgba(239,68,68,0.10)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}>
                    <AlertCircle size={16} color="#ef4444" strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>
                      {REPORT_LABELS[report.report_type] ?? report.report_type}
                    </Text>
                    {report.description ? (
                      <Text style={{ color: colors.textFaint, fontSize: 13, marginBottom: 8, lineHeight: 19 }} numberOfLines={2}>
                        {report.description}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: (STATUS_COLORS[report.status] ?? '#6b7280') + '22',
                      }}>
                        <Text style={{
                          color: STATUS_COLORS[report.status] ?? '#6b7280',
                          fontSize: 11,
                          fontWeight: '700',
                          textTransform: 'capitalize',
                        }}>
                          {report.status}
                        </Text>
                      </View>
                      <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
