import { Text } from 'react-native';
import { Button, Notice, styles } from '../../lib/ui';
import { useRetention } from './useRetention';
export function RetentionSettings({
  model,
}: {
  model: ReturnType<typeof useRetention>;
}) {
  return (
    <>
      <Text style={styles.cardTitle}>Optional activity measurement</Text>
      <Text style={styles.body}>
        Share the eight save and reminder events with PostHog using your account
        ID. Names, screenshots, email and location are excluded. Turning this
        off clears queued events on this phone.
      </Text>
      <Button
        label={
          model.analytics
            ? 'Turn activity measurement off'
            : 'Allow activity measurement'
        }
        secondary
        disabled={model.busy || !model.loaded}
        onPress={() => void model.toggleAnalytics()}
      />
      <Text style={styles.cardTitle}>Optional error reports</Text>
      <Text style={styles.body}>
        Send fixed failure categories and the app version to Sentry to help
        diagnose problems. Reports exclude your account ID, error text, stack,
        screenshots and location. This is separate from activity measurement.
      </Text>
      <Button
        label={
          model.diagnostics ? 'Turn error reports off' : 'Allow error reports'
        }
        secondary
        disabled={model.busy || !model.loaded}
        onPress={() => void model.toggleDiagnostics()}
      />
      <Text style={styles.cardTitle}>Friday nearby digest</Text>
      <Text style={styles.body}>
        At 6 pm in your time zone, receive a count of unvisited saves within 5
        km of your last foreground location check. Enabling uploads nearby place
        IDs for six hours, revealing coarse proximity. Open the app on Friday
        afternoon to refresh. One phone per account receives the digest.
      </Text>
      <Button
        label={model.digest ? 'Turn weekly digest off' : 'Enable weekly digest'}
        secondary
        disabled={model.busy || !model.loaded}
        onPress={() => void model.toggleDigest()}
      />
      {!model.loaded && !model.error && (
        <Text style={styles.body}>Loading privacy preferences…</Text>
      )}
      {model.error && (
        <>
          <Notice>{model.error}</Notice>
          <Button
            label="Retry preferences"
            secondary
            disabled={model.busy}
            onPress={() => void model.retry()}
          />
        </>
      )}
    </>
  );
}
