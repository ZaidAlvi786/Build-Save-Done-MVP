import { FlatList, Text, View } from 'react-native';
import { Button, Notice, styles } from '../../lib/ui';
import { Capture } from './types';
import { SavedPlace } from '../places/remote';
import { useMemo, useState } from 'react';
import { visiblePlaces, Position } from '../places/model';
import { PlaceRow } from '../places/PlaceRow';
import { SavedMap } from '../places/SavedMap';
import { CaptureCard } from './CaptureCard';
import { useEntries } from './useEntries';
export function CaptureScreen({
  items,
  places,
  busy,
  error,
  onGallery,
  onManual,
  onOpen,
  onRetry,
  onRefresh,
  onSettings,
  onRetryShare,
  uid,
  near,
  onNearMe,
  onNavigate,
  onVisit,
  onDelete,
  onRefreshPlace,
  onReminders,
}: {
  items: Capture[];
  places: SavedPlace[];
  busy: boolean;
  error: string | null;
  onGallery: () => void;
  onManual: () => void;
  onOpen: (item: Capture) => void;
  onRetry: (item: Capture) => void;
  onRefresh: () => void;
  onSettings: () => void;
  onRetryShare: () => void;
  uid: string;
  near: Position | null;
  onNearMe: () => void;
  onNavigate: (place: SavedPlace) => void;
  onVisit: (place: SavedPlace) => void;
  onDelete: (place: SavedPlace) => void;
  onRefreshPlace: (place: SavedPlace) => void;
  onReminders: () => void;
}) {
  const [category, setCategory] = useState('all'),
    [map, setMap] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const visible = useMemo(
      () => visiblePlaces(places, category, near),
      [places, category, near],
    ),
    pin = visible.find((p) => p.id === selected) ?? visible[0];
  const entries = useEntries(items, visible);
  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(entry) => `${entry.kind}:${entry.value.id}`}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      renderItem={({ item: entry }) =>
        entry.kind === 'capture' ? (
          <CaptureCard
            item={entry.value}
            busy={busy}
            onOpen={onOpen}
            onRetry={onRetry}
          />
        ) : (
          <PlaceRow
            place={entry.value}
            onNavigate={() => onNavigate(entry.value as SavedPlace)}
            onVisit={() => onVisit(entry.value as SavedPlace)}
            onDelete={() => onDelete(entry.value as SavedPlace)}
            onRefresh={() => onRefreshPlace(entry.value as SavedPlace)}
            onMap={map ? () => setSelected(entry.value.id) : undefined}
          />
        )
      }
      ListHeaderComponent={
        <>
          <Text style={styles.eyebrow}>SAVED → DONE</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Your next good place.
          </Text>
          <Text style={styles.body}>
            Share a screenshot from your gallery, Instagram, TikTok or Maps.
            Check the pin, then keep it.
          </Text>
          <Button label="Choose a screenshot" onPress={onGallery} />
          <Button label="Enter a place manually" secondary onPress={onManual} />
          {busy && (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              Reading your screenshot… Your save is kept on this phone.
            </Text>
          )}
          {error && (
            <>
              <Notice>{error}</Notice>
              <Button label="Retry share" secondary onPress={onRetryShare} />
            </>
          )}
          {items.length === 0 && places.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                A little less saved. A little more done.
              </Text>
              <Text style={styles.body}>
                Your first place starts with a screenshot.
              </Text>
            </View>
          )}
          {places.length > 0 && (
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Confirmed places
            </Text>
          )}
          <View style={styles.row}>
            {['all', 'restaurant', 'cafe', 'shop', 'attraction', 'other'].map(
              (value) => (
                <Button
                  key={value}
                  label={`${category === value ? '✓ ' : ''}${value}`}
                  secondary
                  onPress={() => setCategory(value)}
                />
              ),
            )}
          </View>
          <Button
            label={map ? 'Show list' : 'Show map'}
            secondary
            onPress={() => setMap(!map)}
          />
          <Button
            label={near ? 'Sorted near me · refresh location' : 'Sort near me'}
            secondary
            disabled={busy}
            onPress={onNearMe}
          />
          {map && pin && (
            <SavedMap
              key={`${pin.id}-${pin.coordinates_expire_at}`}
              uid={uid}
              place={pin}
            />
          )}
          {visible.length === 0 && (
            <Text style={styles.body}>
              No saved places in this category yet.
            </Text>
          )}
        </>
      }
      ListFooterComponent={
        <>
          <Button
            label="Nearby reminders and debug"
            secondary
            onPress={onReminders}
          />
          <Button
            label="Refresh saves"
            secondary
            disabled={busy}
            onPress={onRefresh}
          />
          <Button label="Account and privacy" secondary onPress={onSettings} />
        </>
      }
    />
  );
}
