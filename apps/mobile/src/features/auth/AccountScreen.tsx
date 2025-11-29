import { useState } from 'react';
import { Linking, ScrollView, Text } from 'react-native';
import { Button, Field, Notice, styles } from '../../lib/ui';
import { useDeleteAccount } from './useDeleteAccount';
import { RetentionSettings } from '../retention/RetentionSettings';
import { useRetention } from '../retention/useRetention';
export function AccountScreen({
  uid,
  retention,
  onBack,
  onSignOut,
}: {
  uid: string;
  retention: ReturnType<typeof useRetention>;
  onBack: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState('');
  const model = useDeleteAccount(uid);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Button
        label="Back to saves"
        secondary
        disabled={model.busy}
        onPress={onBack}
      />
      <Text accessibilityRole="header" style={styles.title}>
        Account and privacy
      </Text>
      <Text style={styles.body}>
        Your screenshots are private. Nearby reminders will check location on
        this phone. Continuous location is never uploaded.
      </Text>
      <Text style={styles.body}>
        The vision service reads your screenshot to identify a place. Google
        finds the matching place and supplies its map; it receives the place
        query and pin, not your current device location.
      </Text>
      <RetentionSettings model={retention} />
      <Button
        label="Open app permissions"
        secondary
        onPress={() => {
          void Linking.openSettings().catch(() => undefined);
        }}
      />
      <Button
        label="Sign out"
        secondary
        disabled={model.busy}
        onPress={() => void onSignOut()}
      />
      <Text style={styles.cardTitle}>Delete your account</Text>
      <Text style={styles.body}>
        This removes your account, saved places and private screenshots. It also
        clears local saves belonging to this account. This cannot be undone.
        Type DELETE to continue.
      </Text>
      <Text style={styles.body}>
        Previously sent activity events follow the configured PostHog retention
        policy.
      </Text>
      <Field
        label="Type DELETE"
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="characters"
      />
      <Button
        label={model.busy ? 'Deleting…' : 'Delete account and images'}
        disabled={model.busy || confirmation !== 'DELETE'}
        onPress={() => void model.remove(confirmation)}
      />
      {model.error && <Notice>{model.error}</Notice>}
    </ScrollView>
  );
}
