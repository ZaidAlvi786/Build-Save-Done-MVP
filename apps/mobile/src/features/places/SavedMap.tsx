import { useSavedMap } from './useSavedMap';
import { Image, Text, View } from 'react-native';
import { Button, Notice, styles } from '../../lib/ui';
import { SavedPlace, usableCoordinates } from './model';
export function SavedMap({ uid, place }: { uid: string; place: SavedPlace }) {
  const { image, busy, error, load } = useSavedMap(uid, place);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{place.name}</Text>
      {image && usableCoordinates(place) && (
        <Image
          source={{ uri: image }}
          accessibilityLabel={`Saved map pin for ${place.name}`}
          resizeMode="contain"
          style={styles.map}
        />
      )}
      <Text style={{ fontSize: 14, color: '#1F1F1F' }}>Google Maps</Text>
      <Button
        label={busy ? 'Loading map…' : 'Load map pin'}
        disabled={busy || !usableCoordinates(place)}
        secondary
        onPress={() => void load()}
      />
      {error && <Notice>{error}</Notice>}
    </View>
  );
}
