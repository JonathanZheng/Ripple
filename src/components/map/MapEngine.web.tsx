import { View, Text } from 'react-native';
import { Map, Marker } from 'pigeon-maps';
import { useState, useEffect } from 'react';
import type { LocationMarker, MapEngineProps } from './MapEngine';

export type { LocationMarker, MapEngineProps };

export default function MapEngine({ locationMarkers, onLocationPress, userLocation }: MapEngineProps) {
  const [center, setCenter] = useState<[number, number]>([1.3063, 103.7733]);
  const [zoom, setZoom] = useState(15);

  // Center on user when locate-me fires
  useEffect(() => {
    if (userLocation) {
      setCenter(userLocation);
      setZoom(16);
    }
  }, [userLocation]);

  return (
    <View style={{ flex: 1 }}>
      <Map
        center={center}
        zoom={zoom}
        onBoundsChanged={({ center: c, zoom: z }) => { setCenter(c); setZoom(z); }}
        boxClassname="map-dark-mode"
      >
        {/* User location dot */}
        {userLocation && (
          <Marker anchor={userLocation} width={24}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                position: 'absolute',
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: 'rgba(59,130,246,0.25)',
              }} />
              <View style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: '#3b82f6',
                borderWidth: 2,
                borderColor: '#fff',
              }} />
            </View>
          </Marker>
        )}

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
                    backgroundColor: 'rgba(124,58,237,0.65)',
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 2.5,
                    borderColor: 'rgba(255,255,255,0.75)',
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
