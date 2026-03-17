import { View, Text } from 'react-native';
import { Map, Marker } from 'pigeon-maps';
import type { LocationMarker, MapEngineProps } from './MapEngine';

export type { LocationMarker, MapEngineProps };

export default function MapEngine({ locationMarkers, onLocationPress }: MapEngineProps) {
  return (
    <View style={{ flex: 1 }}>
      <Map
        defaultCenter={[1.3063, 103.7733]}
        defaultZoom={15}
        boxClassname="map-dark-mode"
      >
        {locationMarkers.map((marker) => (
          <Marker
            key={marker.name}
            width={marker.quests.length > 0 ? 40 : 14}
            anchor={[marker.latitude, marker.longitude]}
          >
            <div
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              onClick={(e) => {
                e.stopPropagation();
                onLocationPress(marker);
              }}
            >
              {marker.quests.length > 0 ? (
                <View
                  style={{
                    backgroundColor: '#7c3aed',
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 2.5,
                    borderColor: '#fff',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                    {marker.quests.length}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: 'rgba(255,255,255,0.20)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.35)',
                  }}
                />
              )}
            </div>
          </Marker>
        ))}
      </Map>

      <style>{`
        .map-dark-mode { filter: invert(90%) hue-rotate(180deg) brightness(95%); }
        input:focus { outline: none !important; }
      `}</style>
    </View>
  );
}
