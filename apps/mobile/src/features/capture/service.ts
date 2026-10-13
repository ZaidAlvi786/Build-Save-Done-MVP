import { Capture, CaptureStore, CaptureRemote } from './types';
import { EventName, EventProperties } from '../../../../../shared/events';
export function createCaptureService(
  store: CaptureStore,
  remote: CaptureRemote,
  observe: (
    uid: string,
    event: EventName,
    properties: EventProperties,
    key?: string,
  ) => Promise<void> = async () => undefined,
) {
  let running = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>) => {
    const task = running.then(work);
    running = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
  return {
    process(item: Capture, userId: string) {
      return serialize(async () => {
        const current = (await store.list()).find((row) => row.id === item.id);
        if (!current) return null;
        if (current.ownerId && current.ownerId !== userId)
          throw new Error('This save belongs to another account.');
        let next: Capture = { ...current, ownerId: userId, error: null };
        await store.put(next);
        let extracting = false;
        try {
          if ((await remote.ensure(next, userId)) === 'confirmed') {
            await store.remove(next);
            return null;
          }
          if (!next.fileUri) {
            next = {
              ...next,
              error: 'Enter the place name and area to save this link.',
            };
            await store.put(next);
            return next;
          }
          if (!next.uploaded) {
            await remote.upload(next, userId);
            next = { ...next, uploaded: true };
            await store.put(next);
          }
          if (!next.extraction) {
            extracting = true;
            const extraction = await remote.extract(next.id, userId);
            extracting = false;
            try {
              await observe(
                userId,
                extraction.place ? 'extraction_succeeded' : 'extraction_failed',
                {
                  item_id: next.id,
                  ...(!extraction.place
                    ? { reason: 'unidentified' as const }
                    : {}),
                },
                next.id,
              );
            } catch {
              /* Measurement cannot break a save. */
            }
            next = {
              ...next,
              extraction,
              error: extraction.place
                ? null
                : 'We could not identify one place. Enter its name and area.',
            };
            await store.put(next);
          }
          return next;
        } catch {
          if (extracting)
            try {
              await observe(userId, 'extraction_failed', {
                item_id: next.id,
                reason: 'unavailable',
              });
            } catch {
              /* Keep the capture. */
            }
          next = {
            ...next,
            error:
              'Your save is safe on this phone. Retry or enter the place manually.',
          };
          await store.put(next);
          return next;
        }
      });
    },
    bind(item: Capture, userId: string) {
      return serialize(async () => {
        const current = (await store.list()).find((row) => row.id === item.id);
        if (!current || (current.ownerId && current.ownerId !== userId))
          throw new Error('Wrong account');
        const owned = { ...current, ownerId: userId };
        await store.put(owned);
        return owned;
      });
    },
    acknowledged(item: Capture) {
      return serialize(() => store.remove(item));
    },
  };
}
