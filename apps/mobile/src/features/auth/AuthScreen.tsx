import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Field, Notice, styles } from '../../lib/ui';
import { useAuth } from './useAuth';
import { Onboarding } from './Onboarding';
type Auth = ReturnType<typeof useAuth>;
export function AuthScreen({
  auth,
  pendingCount,
}: {
  auth: Auth;
  pendingCount: number;
}) {
  const [email, setEmail] = useState(''),
    [code, setCode] = useState('');
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>SAVED → DONE</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Save a place. Come back when you’re nearby.
      </Text>
      <Text style={styles.body}>
        Keep the places you discover, then turn one of them into your next stop.
      </Text>
      {pendingCount > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {pendingCount} {pendingCount === 1 ? 'save is' : 'saves are'} kept
            on this phone
          </Text>
          <Text style={styles.body}>
            Sign in to finish saving. Your screenshot stays here while you do.
          </Text>
        </View>
      )}
      <Onboarding />
      {!auth.configured ? (
        <Notice>
          Sign-in is unavailable right now. Shared screenshots are kept on this
          phone.
        </Notice>
      ) : auth.sentTo ? (
        <>
          <Text style={styles.body}>Enter the code sent to {auth.sentTo}.</Text>
          <Field
            label="Email code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={8}
          />
          <Button
            label={auth.busy ? 'Signing in…' : 'Sign in'}
            disabled={auth.busy || code.length < 6}
            onPress={() => void auth.verify(code)}
          />
          <Button
            label="Send another code"
            secondary
            disabled={auth.busy}
            onPress={() => void auth.send(auth.sentTo!)}
          />
        </>
      ) : (
        <>
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Button
            label={auth.busy ? 'Sending code…' : 'Continue with email'}
            disabled={auth.busy || !email.includes('@')}
            onPress={() => void auth.send(email)}
          />
        </>
      )}
      {auth.error && <Notice>{auth.error}</Notice>}
      <Text style={styles.body}>
        We’ll explain nearby reminders before asking for location access. You
        can save places without it.
      </Text>
    </ScrollView>
  );
}
