import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { digest, CryptoDigestAlgorithm } from 'expo-crypto';
import { requireUser } from '../../lib/supabase';
import { Capture, CaptureRemote, extractionSchema } from './types';
function path(item: Capture, uid: string) {
  return item.fileUri ? `${uid}/${item.id}/image` : null;
}
export const captureRemote: CaptureRemote = {
  async ensure(item, uid) {
    const client = await requireUser(uid);
    let { data, error } = await client
      .from('saved_items')
      .select('status')
      .eq('id', item.id)
      .maybeSingle();
    if (error) throw new Error('Save unavailable');
    if (data) return data.status === 'confirmed' ? 'confirmed' : 'pending';
    const inserted = await client.from('saved_items').insert({
      id: item.id,
      user_id: uid,
      image_url: path(item, uid),
      source_app: item.sourceApp,
      source_text: item.sourceText?.slice(0, 8000) ?? null,
    });
    if (inserted.error) {
      ({ data, error } = await client
        .from('saved_items')
        .select('status')
        .eq('id', item.id)
        .maybeSingle());
      if (error || !data) throw new Error('Save unavailable');
    }
    return data?.status === 'confirmed' ? 'confirmed' : 'pending';
  },
  async upload(item, uid) {
    const client = await requireUser(uid);
    if (!item.fileUri) throw new Error('Missing image');
    let file = new File(item.fileUri);
    let mime = item.mime;
    if (
      !mime ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(mime) ||
      file.size > 5 * 1024 * 1024
    ) {
      const target = new File(
        item.fileUri.substring(0, item.fileUri.lastIndexOf('/') + 1) +
          'image.upload.jpg',
      );
      if (!target.exists) {
        const result = await manipulateAsync(
          item.fileUri,
          [{ resize: { width: 1600 } }],
          { compress: 0.75, format: SaveFormat.JPEG },
        );
        const temporary = new File(result.uri);
        try {
          temporary.copy(target);
        } finally {
          if (temporary.exists) temporary.delete();
        }
      }
      file = target;
      mime = 'image/jpeg';
    }
    if (file.size > 5 * 1024 * 1024) throw new Error('Image too large');
    const bytes = await file.arrayBuffer();
    const { error } = await client.storage
      .from('captures')
      .upload(path(item, uid)!, bytes, {
        contentType: mime!,
        upsert: false,
      });
    if (error) {
      // A crash after upload may leave the local flag unset; verify existing bytes.
      const existing = await client.storage
        .from('captures')
        .download(path(item, uid)!);
      if (existing.error || !existing.data || existing.data.size !== file.size)
        throw new Error('Upload unavailable');
      const a = new Uint8Array(
        await digest(CryptoDigestAlgorithm.SHA256, bytes),
      );
      const b = new Uint8Array(
        await digest(
          CryptoDigestAlgorithm.SHA256,
          await existing.data.arrayBuffer(),
        ),
      );
      if (!a.every((value, index) => value === b[index]))
        throw new Error('Upload mismatch');
    }
  },
  async extract(id, uid) {
    const client = await requireUser(uid);
    const { data, error } = await client.functions.invoke('extract-place', {
      body: { saved_item_id: id },
    });
    if (error) throw new Error('Extraction unavailable');
    return extractionSchema.parse(data.result);
  },
};
