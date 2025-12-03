import { Text, View } from 'react-native';
import { Button, styles } from '../../lib/ui';
import { Capture } from './types';
export function CaptureCard({
  item,
  busy,
  onOpen,
  onRetry,
}: {
  item: Capture;
  busy: boolean;
  onOpen: (item: Capture) => void;
  onRetry: (item: Capture) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {item.extraction?.place?.name ??
          (item.sourceApp === 'manual'
            ? 'New place'
            : item.fileUri
              ? 'Saved screenshot'
              : 'Saved link')}
      </Text>
      <Text style={styles.body}>
        {item.error ??
          (item.extraction?.place
            ? 'Ready to check the pin.'
            : 'Kept safely while we read it.')}
      </Text>
      <Button
        label={
          item.extraction?.place ? 'Check this place' : 'Enter or fix the place'
        }
        secondary
        onPress={() => onOpen(item)}
      />
      {item.error && item.fileUri && (
        <Button
          label="Retry extraction"
          secondary
          disabled={busy}
          onPress={() => onRetry(item)}
        />
      )}
    </View>
  );
}
