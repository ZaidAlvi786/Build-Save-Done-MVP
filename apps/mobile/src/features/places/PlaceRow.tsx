import { useMemo } from 'react';
import { PanResponder, Text, View } from 'react-native';
import { Button, styles } from '../../lib/ui';
import { SavedPlace, usableCoordinates } from './model';
export function PlaceRow({
  place,
  onVisit,
  onDelete,
  onNavigate,
  onRefresh,
  onMap,
}: {
  place: SavedPlace;
  onVisit: () => void;
  onDelete: () => void;
  onNavigate: () => void;
  onRefresh: () => void;
  onMap?: (() => void) | undefined;
}) {
  const gesture = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => {
          if (g.dx > 80) onVisit();
          else if (g.dx < -80) onDelete();
        },
      }),
    [onVisit, onDelete],
  );
  return (
    <View style={styles.card} {...gesture.panHandlers}>
      <Text style={styles.cardTitle}>{place.name}</Text>
      <Text style={styles.body}>{place.address}</Text>
      <Text style={styles.body}>
        {place.category} · {place.status === 'visited' ? 'Visited' : 'Saved'} ·
        swipe right to mark visited, left to delete
      </Text>
      {usableCoordinates(place) ? (
        <Button label={`Navigate to ${place.name}`} onPress={onNavigate} />
      ) : (
        <Button
          label={`Refresh location for ${place.name}`}
          onPress={onRefresh}
        />
      )}
      <Button
        label={`Mark ${place.name} visited`}
        secondary
        disabled={place.status === 'visited'}
        onPress={onVisit}
      />
      <Button label={`Delete ${place.name}`} secondary onPress={onDelete} />
      {onMap && (
        <Button label={`Show ${place.name} on map`} secondary onPress={onMap} />
      )}
    </View>
  );
}
