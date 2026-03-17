import { View, Text, Platform } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { MapPin } from 'lucide-react-native';
import { TAG_COLOURS } from '@/constants';
import type { Quest } from '@/types/database';

export interface MapEngineProps {
  clusters: Quest[][];
  isPickingMode: boolean;
  pickedLocation: [number, number] | null;
  onClusterPress: (quests: Quest[]) => void;
  onMapPress: (lat: number, lon: number) => void;
}

const CARTO_DARK_TILE = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

const UTOWN_REGION = {
  latitude: 1.3063,
  longitude: 103.7733,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export default function MapEngine({
  clusters,
  isPickingMode,
  pickedLocation,
  onClusterPress,
  onMapPress,
}: MapEngineProps) {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={UTOWN_REGION}
      mapType={Platform.OS === 'android' ? 'none' : 'standard'}
      onPress={(e) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        onMapPress(latitude, longitude);
      }}
    >
      {Platform.OS === 'android' && (
        <UrlTile urlTemplate={CARTO_DARK_TILE} maximumZ={19} flipY={false} />
      )}

      {!isPickingMode &&
        clusters.map((clusterQuests) => {
          const first = clusterQuests[0];
          const count = clusterQuests.length;
          const isCluster = count > 1;

          return (
            <Marker
              key={first.id}
              coordinate={{ latitude: first.latitude!, longitude: first.longitude! }}
              tracksViewChanges={false}
              onPress={() => onClusterPress(clusterQuests)}
            >
              {isCluster ? (
                <View
                  style={{
                    backgroundColor: '#7c3aed',
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    borderWidth: 3,
                    borderColor: '#fff',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                    {count}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    padding: 8,
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor: '#fff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: TAG_COLOURS[first.tag] || '#7c3aed',
                    opacity: 0.85,
                  }}
                >
                  <MapPin size={18} color="#fff" />
                </View>
              )}
            </Marker>
          );
        })}

      {isPickingMode && pickedLocation && (
        <Marker
          coordinate={{ latitude: pickedLocation[0], longitude: pickedLocation[1] }}
          tracksViewChanges={false}
        >
          <View
            style={{
              backgroundColor: '#ef4444',
              padding: 10,
              borderRadius: 30,
              borderWidth: 3,
              borderColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapPin size={24} color="#fff" />
          </View>
        </Marker>
      )}
    </MapView>
  );
}
