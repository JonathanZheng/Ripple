import { View, Text, Platform } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { MapPin } from 'lucide-react-native';
import type { Quest } from '@/types/database';

export interface LocationMarker {
  name: string;
  latitude: number;
  longitude: number;
  quests: Quest[];
}

export interface FocusPin {
  latitude: number;
  longitude: number;
  label: string;
}

export interface MapEngineProps {
  locationMarkers: LocationMarker[];
  onLocationPress: (marker: LocationMarker) => void;
  userLocation?: [number, number] | null;
  mapRef?: React.RefObject<MapView>;
  focusPin?: FocusPin | null;
}

const CARTO_DARK_TILE = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

const UTOWN_REGION = {
  latitude: 1.3063,
  longitude: 103.7733,
  latitudeDelta: 0.022,
  longitudeDelta: 0.022,
};

export default function MapEngine({
  locationMarkers,
  onLocationPress,
  mapRef,
  focusPin,
}: MapEngineProps) {
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

      {/* Quest cluster markers */}
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

      {/* Shared location pin (from DM deep-link) */}
      {focusPin && (
        <Marker
          key="focus-pin"
          coordinate={{ latitude: focusPin.latitude, longitude: focusPin.longitude }}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={{ alignItems: 'center' }}>
            {/* Label */}
            <View
              style={{
                backgroundColor: 'rgba(10,10,14,0.85)',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(59,130,246,0.5)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                marginBottom: 4,
                maxWidth: 140,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                {focusPin.label}
              </Text>
            </View>

            {/* Pin circle */}
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: '#3b82f6',
                borderWidth: 3,
                borderColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#3b82f6',
                shadowOpacity: 0.6,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
                elevation: 6,
              }}
            >
              <MapPin size={16} color="#fff" strokeWidth={2.5} />
            </View>

            {/* Pin tail */}
            <View
              style={{
                width: 3,
                height: 8,
                backgroundColor: '#3b82f6',
                borderBottomLeftRadius: 2,
                borderBottomRightRadius: 2,
              }}
            />
          </View>
        </Marker>
      )}
    </MapView>
  );
}
