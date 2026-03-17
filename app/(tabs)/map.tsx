import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTheme } from '@/lib/ThemeContext';
import { MapPin } from 'lucide-react-native';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Map" subtitle="Coming soon" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: insets.bottom + 100 }}>
        <MapPin size={48} color="rgba(255,255,255,0.10)" strokeWidth={1.5} />
        <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 15, marginTop: 16, letterSpacing: -0.2 }}>
          Map view is coming soon
        </Text>
      </View>
    </View>
  );
}
