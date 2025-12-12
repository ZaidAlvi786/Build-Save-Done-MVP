import { ScrollView, Text, View } from 'react-native';
import { Button, Field, Notice, styles } from '../../lib/ui';
import { SavedPlace } from '../places/model';
import { useReminderSettings } from './useReminderSettings';
export function ReminderScreen({
  uid,
  places,
  radius,
  onRadius,
  onBack,
}: {
  uid: string;
  places: SavedPlace[];
  radius: number;
  onRadius: (radius: number) => void;
  onBack: () => void;
}) {
  const model = useReminderSettings(uid, places, radius, onRadius);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Button
        label="Back to saves"
        secondary
        disabled={model.busy}
        onPress={onBack}
      />
      <Text accessibilityRole="header" style={styles.title}>
        Nearby reminders
      </Text>
      <Text style={styles.body}>
        Always location lets this phone remind you near places you saved, even
        when the app is in the background. Movement updates help select nearby
        places and stay on this phone. Android shows an ongoing reminder
        notification. Your location is never uploaded. You can keep using the
        list if you decline.
      </Text>
      <Text style={styles.body}>
        Android may open Settings: choose Allow all the time. Notifications must
        also be enabled. Force-stopping the app pauses reminders until you
        reopen it.
      </Text>
      <Field
        label="Reminder radius in metres (100–2000)"
        value={model.value}
        onChangeText={model.setValue}
        keyboardType="number-pad"
      />
      <Button
        label={model.busy ? 'Working…' : 'Enable nearby reminders'}
        disabled={model.busy}
        onPress={() => void model.enable()}
      />
      <Button
        label="Turn off reminders"
        secondary
        disabled={model.busy}
        onPress={() => void model.disable()}
      />
      <Button
        label="Open app permissions"
        secondary
        disabled={model.busy}
        onPress={() => void model.settings()}
      />
      {model.error && <Notice>{model.error}</Notice>}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Geofence debug</Text>
        <Text selectable style={styles.body}>
          {model.snapshot}
        </Text>
        <Button
          label="Refresh debug status"
          secondary
          disabled={model.busy}
          onPress={() => void model.refresh()}
        />
        <Button
          label="Retry reminder sync"
          secondary
          disabled={model.busy}
          onPress={() => void model.sync()}
        />
      </View>
    </ScrollView>
  );
}
