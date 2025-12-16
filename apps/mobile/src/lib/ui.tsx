import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ComponentProps, ReactNode } from 'react';
export const palette = {
  background: '#F6F4ED',
  ink: '#17372B',
  muted: '#4F6259',
  line: '#D5DED6',
  white: '#FFFFFF',
  danger: '#942D23',
};
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={palette.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" style={styles.notice}>
      {children}
    </Text>
  );
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, paddingBottom: 48, gap: 16 },
  eyebrow: {
    fontSize: 13,
    letterSpacing: 2,
    color: palette.muted,
    fontWeight: '700',
  },
  title: {
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '700',
    color: palette.ink,
  },
  body: { fontSize: 17, lineHeight: 25, color: palette.muted },
  card: {
    backgroundColor: palette.white,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: palette.ink },
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink,
    padding: 14,
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: palette.white },
  secondary: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
  },
  secondaryText: { color: palette.ink },
  disabled: { opacity: 0.45 },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600', color: palette.ink },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    color: palette.ink,
    backgroundColor: palette.white,
  },
  notice: { fontSize: 16, lineHeight: 24, color: palette.danger },
  map: {
    width: '100%',
    aspectRatio: 600 / 320,
    backgroundColor: palette.line,
    borderRadius: 12,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
