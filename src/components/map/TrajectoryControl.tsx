import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { useTrajectory, TransportMode } from '@/hooks/useTrajectory';
import { NUS_LOCATIONS } from '@/constants'; // Restoring your original location list
import { X, Navigation2 } from 'lucide-react-native';

export const TrajectoryControl = ({ userId, userLocation, onClose }: any) => {
  const [selectedDest, setSelectedDest] = useState<any>(null);
  
  const { 
    journeyStatus, 
    timeLeft, 
    matches, 
    startBroadcast, 
    getAIGuidedResults 
  } = useTrajectory(userId, userLocation ? { latitude: userLocation[0], longitude: userLocation[1] } : null as any);

  // --- STATE 1: ORIGINAL UI (Pick NUS Location) ---
  if (journeyStatus === 'idle') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Where are you going?</Text>
          <TouchableOpacity onPress={onClose}><X color="#fff" /></TouchableOpacity>
        </View>
        <FlatList
          data={NUS_LOCATIONS}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.locItem, selectedDest?.name === item.name && styles.selectedLoc]} 
              onPress={() => setSelectedDest(item)}
            >
              <Text style={styles.locText}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
        {selectedDest && (
          <View style={styles.footer}>
            <Text style={{color: '#aaa', marginBottom: 10}}>Leaving in:</Text>
            <View style={styles.row}>
              {[5, 10, 15].map(m => (
                <TouchableOpacity key={m} style={styles.timeBtn} onPress={() => startBroadcast(selectedDest, m, 'walking')}>
                  <Text style={styles.btnText}>{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  // --- STATE 2: WAITING (Timer) ---
  if (journeyStatus === 'waiting') {
    return (
      <View style={styles.center}>
        <Text style={styles.blue}>📡 BROADCASTING ROUTE TO {selectedDest?.name}...</Text>
        <Text style={styles.timer}>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
        <TouchableOpacity style={styles.leaveNow} onPress={() => getAIGuidedResults(selectedDest, 'walking')}>
          <Text style={{color: 'white', fontWeight: 'bold'}}>I'm Leaving Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- STATE 3: LOADING ---
  if (journeyStatus === 'loading') {
    return (
      <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /><Text style={{color: '#fff', marginTop: 20}}>AI is optimizing your route...</Text></View>
    );
  }

  // --- STATE 4: MANIFEST ---
  return (
    <View style={styles.container}>
      <Text style={styles.manifestTitle}>✨ Mission Manifest</Text>
      <ScrollView style={{padding: 20}}>
        {matches.length === 0 ? (
          <Text style={{color: '#666', textAlign: 'center'}}>No quests found. Safe travels!</Text>
        ) : (
          matches.map((q) => (
            <View key={q.id} style={styles.card}>
              <Text style={styles.ai}>{(q.ai_match_score * 100).toFixed(0)}% AI Match</Text>
              <Text style={styles.locCardName}>{q.location_name}</Text>
              <Text style={styles.type}>{q.is_at_destination ? '🏁 Drop-off' : '📦 Pick-up'}</Text>
              <Text style={styles.bounty}>${q.bounty}</Text>
            </View>
          ))
        )}
      </ScrollView>
      <TouchableOpacity style={styles.doneBtn} onPress={onClose}><Text style={{color: '#fff', fontWeight: 'bold'}}>Start Journey</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#222' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  locItem: { padding: 18, borderBottomWidth: 1, borderColor: '#222' },
  selectedLoc: { backgroundColor: '#1e3a8a' },
  locText: { color: '#fff', fontSize: 16 },
  footer: { padding: 20, borderTopWidth: 1, borderColor: '#222' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  timeBtn: { backgroundColor: '#333', padding: 12, borderRadius: 8, width: '30%', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  timer: { fontSize: 70, color: '#fff', fontWeight: 'bold', marginVertical: 30 },
  blue: { color: '#3b82f6', fontWeight: 'bold' },
  leaveNow: { backgroundColor: '#3b82f6', padding: 18, borderRadius: 12, width: '80%', alignItems: 'center' },
  manifestTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', padding: 20 },
  card: { backgroundColor: '#1e1e20', padding: 15, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#10b981' },
  ai: { color: '#3b82f6', fontSize: 12, fontWeight: 'bold' },
  locCardName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  type: { color: '#aaa', fontSize: 12 },
  bounty: { color: '#10b981', fontWeight: 'bold', marginTop: 5 },
  doneBtn: { backgroundColor: '#000', padding: 20, alignItems: 'center', margin: 20, borderRadius: 12 }
});