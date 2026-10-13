export async function readLimited(
  stream: ReadableStream<Uint8Array> | null,
  maximum: number,
): Promise<Uint8Array> {
  if (!stream) throw new Error('empty_stream');
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximum) {
        await reader.cancel();
        throw new Error('size_limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function validateImage(bytes: Uint8Array, declared: string): string {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new Error('invalid_image');
  const match = (offset: number, signature: number[]) =>
    signature.every((v, i) => bytes[offset + i] === v);
  const mime = match(0, [137, 80, 78, 71, 13, 10, 26, 10])
    ? 'image/png'
    : match(0, [255, 216, 255])
      ? 'image/jpeg'
      : match(0, [82, 73, 70, 70]) && match(8, [87, 69, 66, 80])
        ? 'image/webp'
        : null;
  if (!mime || mime !== declared.toLowerCase())
    throw new Error('invalid_image');
  return mime;
}
