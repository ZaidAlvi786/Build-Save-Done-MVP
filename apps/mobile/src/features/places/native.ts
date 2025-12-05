import { Alert, Linking } from 'react-native';
import { SavedPlace, usableCoordinates } from '../places/model';
export async function navigateTo(place: SavedPlace) {
  if (!usableCoordinates(place))
    throw new Error('Refresh this place before navigation');
  // Only the destination is shared with Maps; no origin location is supplied.
  const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  if (!(await Linking.canOpenURL(url))) throw new Error('Maps is unavailable');
  await Linking.openURL(url);
}
export function confirmPlaceDeletion(name: string, remove: () => void) {
  Alert.alert(
    'Delete saved place?',
    `Remove ${name} and its private screenshot?`,
    [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ],
  );
}
