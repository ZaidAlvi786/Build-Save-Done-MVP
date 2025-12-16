import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
// Chunk long sessions instead of assuming iOS Keychain accepts arbitrarily large values.
const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
type Manifest = { revision: string; count: number };
async function manifest(key: string): Promise<Manifest | null> {
  const value = await SecureStore.getItemAsync(`${key}.meta`, options);
  if (!value) return null;
  const result = JSON.parse(value) as Manifest;
  if (
    !/^[a-zA-Z0-9-]+$/.test(result.revision) ||
    !Number.isInteger(result.count) ||
    result.count < 1 ||
    result.count > 200
  )
    throw new Error('Invalid session');
  return result;
}
async function erase(key: string, m: Manifest | null) {
  if (m)
    for (let i = 0; i < m.count; i++)
      await SecureStore.deleteItemAsync(`${key}.${m.revision}.${i}`, options);
}
export const sessionStorage = {
  async getItem(key: string) {
    const m = await manifest(key);
    if (!m) return null;
    let value = '';
    for (let i = 0; i < m.count; i++) {
      const chunk = await SecureStore.getItemAsync(
        `${key}.${m.revision}.${i}`,
        options,
      );
      if (chunk === null) return null;
      value += chunk;
    }
    return value;
  },
  async setItem(key: string, value: string) {
    if (value.length > 100000) throw new Error('Session too large');
    const old = await manifest(key),
      revision = Crypto.randomUUID(),
      count = Math.max(1, Math.ceil(value.length / 500));
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        `${key}.${revision}.${i}`,
        value.slice(i * 500, (i + 1) * 500),
        options,
      );
    await SecureStore.setItemAsync(
      `${key}.meta`,
      JSON.stringify({ revision, count }),
      options,
    );
    await erase(key, old);
  },
  async removeItem(key: string) {
    const old = await manifest(key);
    await SecureStore.deleteItemAsync(`${key}.meta`, options);
    await erase(key, old);
  },
};
