import { z } from 'zod';
export const categorySchema = z.enum([
  'restaurant',
  'cafe',
  'shop',
  'attraction',
  'other',
]);
export type Category = z.infer<typeof categorySchema>;
export const extractionSchema = z
  .object({
    place: z
      .object({
        name: z.string().trim().min(1).max(200),
        area: z.string().max(200).nullable(),
        address: z.string().max(500).nullable(),
        category: categorySchema,
        confidence: z.number().min(0).max(1),
      })
      .strict()
      .nullable(),
    reason: z.enum(['identified', 'ambiguous', 'no_place', 'unreadable']),
  })
  .strict()
  .refine((v) => (v.place !== null) === (v.reason === 'identified'));
export type Extraction = z.infer<typeof extractionSchema>;
export const captureSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  ownerId: z.string().uuid().nullable(),
  sourceKey: z.string(),
  fileUri: z.string().nullable(),
  originalUri: z.string().nullable(),
  mime: z.string().nullable(),
  sourceText: z.string().nullable(),
  sourceApp: z.enum(['share', 'gallery', 'manual']),
  createdAt: z.string(),
  uploaded: z.boolean(),
  extraction: extractionSchema.nullable(),
  error: z.string().nullable(),
});
export type Capture = z.infer<typeof captureSchema>;
export type Incoming = {
  uri: string | null;
  mime: string | null;
  text: string | null;
  sourceApp: Capture['sourceApp'];
};
export interface CaptureStore {
  list(): Promise<Capture[]>;
  put(item: Capture): Promise<void>;
  remove(item: Capture): Promise<void>;
  ingest(input: Incoming): Promise<Capture>;
}
export interface CaptureRemote {
  ensure(item: Capture, userId: string): Promise<'pending' | 'confirmed'>;
  upload(item: Capture, userId: string): Promise<void>;
  extract(id: string, userId: string): Promise<Extraction>;
}
