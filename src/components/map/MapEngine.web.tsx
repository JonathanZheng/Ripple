import { View, Text } from 'react-native';
import { Map, Marker } from 'pigeon-maps';
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

export default function MapEngine({
  clusters,
  isPickingMode,
  pickedLocation,
  onClusterPress,
  onMapPress,
}: MapEngineProps) {
  return (
    <View style={{ flex: 1 }}>
      <Map
        defaultCenter={[1.3063, 103.7733]}
        defaultZoom={15}
        onClick={({ latLng }) => onMapPress(latLng[0], latLng[1])}
        boxClassname="map-dark-mode"
      >
        {!isPickingMode &&
          clusters.map((clusterQuests) => {
            const first = clusterQuests[0];
            const count = clusterQuests.length;
            const isCluster = count > 1;

            return (
              <Marker
                key={first.id}
                width={isCluster ? 50 : 40}
                anchor={[first.latitude!, first.longitude!]}
              >
                <div
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClusterPress(clusterQuests);
                  }}
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
                </div>
              </Marker>
            );
          })}

        {isPickingMode && pickedLocation && (
          <Marker anchor={pickedLocation} width={40}>
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
      </Map>

      <style>{`
        .map-dark-mode { filter: invert(90%) hue-rotate(180deg) brightness(95%); }
        input:focus { outline: none !important; }
      `}</style>
    </View>
  );
}
