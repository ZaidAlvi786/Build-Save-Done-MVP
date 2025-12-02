import { reportIssue } from '../../lib/diagnostics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShareIntentContext } from 'expo-share-intent';
import { AppState } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { captureStore } from './local-store';
import { captureRemote } from './remote';
import { createCaptureService } from './service';
import { Capture, Incoming } from './types';
import { track } from '../analytics/client';
const service = createCaptureService(captureStore, captureRemote, track);
export function useCapture(uid: string | null) {
  const [retryShareTick, setRetryShareTick] = useState(0);
  const [items, setItems] = useState<Capture[]>([]),
    [busy, setBusy] = useState(false),
    [importing, setImporting] = useState(false),
    [error, setError] = useState<string | null>(null);
  const {
    hasShareIntent,
    shareIntent,
    resetShareIntent,
    error: nativeError,
  } = useShareIntentContext();
  const current = useRef(shareIntent);
  const attempted = useRef<typeof shareIntent | null>(null);
  const scope = useRef(uid);
  useEffect(() => {
    current.current = shareIntent;
    scope.current = uid;
  }, [shareIntent, uid]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    try {
      let rows = await captureStore.list();
      setBusy(true);
      if (alive.current && scope.current === uid)
        setItems(rows.filter((r) => !r.ownerId || r.ownerId === uid));
      if (uid)
        for (const item of rows.filter(
          (r) => (!r.ownerId || r.ownerId === uid) && !r.extraction && !r.error,
        )) {
          if (scope.current !== uid) break;
          if (item.sourceApp !== 'manual')
            await track(
              uid,
              'share_received',
              {
                item_id: item.id,
                source: item.sourceApp === 'gallery' ? 'gallery' : 'share',
              },
              item.id,
            );
          await service.process(item, uid);
        }
      rows = await captureStore.list();
      if (alive.current && scope.current === uid)
        setItems(rows.filter((r) => !r.ownerId || r.ownerId === uid));
    } catch {
      void reportIssue(uid, 'capture');
      if (alive.current) setError('Your saves could not be opened. Try again.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [uid]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [refresh]);
  useEffect(() => {
    if (!hasShareIntent || importing || attempted.current === shareIntent)
      return;
    attempted.current = shareIntent;
    const snapshot = shareIntent;
    setImporting(true);
    setError(null);
    void (async () => {
      try {
        const files = snapshot.files ?? [],
          text = snapshot.text ?? snapshot.webUrl;
        if (files.length === 0) {
          if (!text) throw new Error('Empty share');
          await captureStore.ingest({
            uri: null,
            mime: null,
            text,
            sourceApp: 'share',
          });
        }
        for (const file of files)
          await captureStore.ingest({
            uri: file.path,
            mime: file.mimeType,
            text,
            sourceApp: 'share',
          });
        if (current.current === snapshot) resetShareIntent(); // Clear only after durable copies/journals.
        await refresh();
      } catch {
        if (alive.current)
          setError(
            'Could not keep the share yet. Tap Retry share, or share it again.',
          );
      } finally {
        if (alive.current) setImporting(false);
      }
    })();
  }, [
    hasShareIntent,
    shareIntent,
    resetShareIntent,
    refresh,
    importing,
    retryShareTick,
  ]);
  async function ingest(input: Incoming) {
    setError(null);
    try {
      const item = await captureStore.ingest(input);
      await refresh();
      return item;
    } catch {
      setError('Could not keep the image. Check free storage and try again.');
      return null;
    }
  }
  return {
    items,
    busy,
    importing,
    error: error ?? nativeError,
    refresh,
    async gallery() {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 1,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset) return;
        await ingest({
          uri: asset.uri,
          mime:
            asset.mimeType ??
            (asset.uri.toLowerCase().endsWith('.png')
              ? 'image/png'
              : 'image/jpeg'),
          text: null,
          sourceApp: 'gallery',
        });
      } catch {
        setError(
          'Photo access is unavailable. Check permissions in Settings or share from your gallery.',
        );
      }
    },
    async manual() {
      return ingest({ uri: null, mime: null, text: null, sourceApp: 'manual' });
    },
    async retry(item: Capture) {
      if (!uid) return;
      setBusy(true);
      try {
        await service.process({ ...item, error: null }, uid);
        await refresh();
      } catch {
        setError('Retry could not finish. Your save is kept.');
      } finally {
        setBusy(false);
      }
    },
    retryShare() {
      attempted.current = null;
      setRetryShareTick((value) => value + 1);
    },
    async bind(item: Capture) {
      if (!uid) return null;
      return service.bind(item, uid);
    },
    async acknowledged(item: Capture) {
      await service.acknowledged(item);
      await refresh();
    },
  };
}
