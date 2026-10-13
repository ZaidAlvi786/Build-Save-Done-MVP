import { Text, View } from 'react-native';
import { styles } from '../../lib/ui';
export function Onboarding() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>From screenshot to your next stop</Text>
      <Text style={styles.body}>
        1. Share a screenshot to Saved → Done, or choose one from your gallery.
      </Text>
      <Text style={styles.body}>
        2. Check the place and map pin. Fix the name or choose another match
        when needed.
      </Text>
      <Text style={styles.body}>
        3. Enable nearby reminders when you’re ready, then navigate or mark the
        place visited.
      </Text>
      <Text style={styles.body}>
        After sign-in, your screenshot is uploaded privately and read by a
        vision service to find the place. If it cannot find one, your save stays
        available for manual entry. Links also use manual entry.
      </Text>
    </View>
  );
}
