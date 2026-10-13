import { ShareIntentProvider } from 'expo-share-intent';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Root } from './src/app/Root';
import { styles } from './src/lib/ui';
import { ErrorBoundary } from './src/lib/ErrorBoundary';
export default function App() {
  return (
    <SafeAreaProvider>
      <ShareIntentProvider options={{ debug: false, resetOnBackground: false }}>
        <SafeAreaView style={styles.page}>
          <ErrorBoundary>
            <Root />
          </ErrorBoundary>
        </SafeAreaView>
      </ShareIntentProvider>
    </SafeAreaProvider>
  );
}
