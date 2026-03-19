import { View, Text, Platform } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import type { Quest } from '@/types/database';

export interface LocationMarker {
  name: string;
  latitude: number;
  longitude: number;
  quests: Quest[];
}

export interface MapEngineProps {
  locationMarkers: LocationMarker[];
  onLocationPress: (marker: LocationMarker) => void;
  userLocation?: [number, number] | null;
  mapRef?: React.RefObject<MapView>;
}

const CARTO_DARK_TILE = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

const UTOWN_REGION = {
  latitude: 1.3063,
  longitude: 103.7733,
  latitudeDelta: 0.022,
  longitudeDelta: 0.022,
};

export default function MapEngine({ locationMarkers, onLocationPress, mapRef }: MapEngineProps) {
  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={UTOWN_REGION}
      mapType={Platform.OS === 'android' ? 'none' : 'standard'}
      showsUserLocation={true}
      showsMyLocationButton={false}
    >
      {Platform.OS === 'android' && (
        <UrlTile urlTemplate={CARTO_DARK_TILE} maximumZ={19} flipY={false} />
      )}

      {locationMarkers.map((marker) => (
        <Marker
          key={marker.name}
          coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
          tracksViewChanges={false}
          onPress={() => onLocationPress(marker)}
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
        </Marker>
      ))}
    </MapView>
  );
}
