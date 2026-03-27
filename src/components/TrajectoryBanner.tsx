import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Zap, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export const TrajectoryBanner = ({ userId }: { userId: string }) => {
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const fetchJourney = async () => {
    if (!userId) return;

    // SIMPLIFIED QUERY: Just find the latest 'waiting' journey
    const { data, error } = await supabase
      .from('route_offers')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveJourney(data);
      // Calculate remaining time
      const createdAt = new Date(data.created_at).getTime();
      const delayMs = (data.departure_delay_seconds || 0) * 1000;
      const remaining = Math.max(0, Math.floor((createdAt + delayMs - Date.now()) / 1000));
      setTimeLeft(remaining);
    } else {
      setActiveJourney(null);
    }
  };

  useEffect(() => {
    fetchJourney();
    const interval = setInterval(fetchJourney, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  if (!activeJourney) return null;

  const isReady = timeLeft <= 0;

  return (
    <TouchableOpacity 
      onPress={() => router.push({
        pathname: '/route-offer-confirm',
        params: { resumeId: activeJourney.id }
      })}
      style={[styles.banner, isReady && styles.readyBanner]}
      activeOpacity={0.8}
    >
      <View style={[styles.iconBox, isReady && { backgroundColor: '#10b981' }]}>
        <Zap size={18} color="#fff" fill={isReady ? "#fff" : "transparent"} />
      </View>
      
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {isReady ? "Mission Ready!" : "Broadcasting Route..."}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {isReady 
            ? "Tap to build your checklist." 
            : `Leaving for ${activeJourney.destination_name} in ${Math.floor(timeLeft/60)}m ${timeLeft%60}s`}
        </Text>
      </View>

      <View style={[styles.goNowBtn, isReady && styles.goNowBtnReady]}>
        <Text style={styles.goText}>{isReady ? "GO NOW" : "VIEW"}</Text>
        <ChevronRight size={14} color="#fff" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(59,130,246,0.15)', 
    borderWidth: 1, 
    borderColor: 'rgba(59,130,246,0.4)', 
    borderRadius: 18, 
    padding: 14, 
    marginHorizontal: 16, 
    marginTop: 10,
    marginBottom: 5,
    gap: 12 
  },
  readyBanner: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.5)' },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  goNowBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  goNowBtnReady: { backgroundColor: '#10b981' },
  goText: { color: '#fff', fontSize: 10, fontWeight: '900' }
});