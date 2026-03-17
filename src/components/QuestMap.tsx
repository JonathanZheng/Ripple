import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { Map, Marker as WebMarker } from 'pigeon-maps'; // Free Map for Web
import { MapPin } from 'lucide-react-native';
import { TAG_COLOURS } from '@/constants';
import type { Quest } from '@/types/database';

interface QuestMapProps {
  quests: Quest[];
  onQuestPress: (quest: Quest) => void;
}

export const QuestMap: React.FC<QuestMapProps> = ({ quests, onQuestPress }) => {
  // Center of Singapore
  const center: [number, number] = [1.3521, 103.8198];

  // WEB VERSION (Free - No API Key)
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Map 
          defaultCenter={center} 
          defaultZoom={12}
          // This makes it feel like a real dark-mode map
          boxClassname="pigeon-filters" 
        >
          {quests.map((quest) => (
            <WebMarker
              key={quest.id}
              width={40}
              anchor={[quest.latitude || 1.35, quest.longitude || 103.8]}
              onClick={() => onQuestPress(quest)}
            >
              <View style={[styles.markerBubble, { backgroundColor: TAG_COLOURS[quest.tag] || '#7c3aed' }]}>
                <MapPin size={16} color="#fff" />
              </View>
            </WebMarker>
          ))}
        </Map>
        
        {/* Simple CSS to make the free map look Dark Mode */}
        <style>{`
          .pigeon-filters { filter: invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%); }
        `}</style>
      </View>
    );
  }

  // MOBILE VERSION (Uses Native Apple/Google maps - Free on Device)
  return (
    <View style={styles.container}>
       <Text style={{ color: 'white', marginTop: 100, textAlign: 'center' }}>
         On mobile, use react-native-maps here.
       </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  markerBubble: {
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    cursor: 'pointer',
  },
});

export default QuestMap;