import { Component, ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button, styles } from './ui';
import { reportRenderFailure } from './diagnostics';
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    void reportRenderFailure();
  }
  render() {
    if (this.state.failed)
      return (
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            Let’s reopen your saves.
          </Text>
          <Text style={styles.body}>
            This screen could not load. Saved screenshots remain on this phone.
            Try again; if it keeps happening, reopen the app.
          </Text>
          <Button
            label="Try again"
            onPress={() => this.setState({ failed: false })}
          />
        </View>
      );
    return this.props.children;
  }
}
