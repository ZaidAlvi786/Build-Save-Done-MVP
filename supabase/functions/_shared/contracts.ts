import { z } from 'zod';
export const categories = [
  'restaurant',
  'cafe',
  'shop',
  'attraction',
  'other',
] as const;
const field = (max: number) => z.string().trim().min(1).max(max);
export const extractionSchema = z
  .object({
    place: z
      .object({
        name: field(200),
        area: field(200).nullable(),
        address: field(500).nullable(),
        category: z.enum(categories),
        confidence: z.number().min(0).max(1),
      })
      .strict()
      .nullable(),
    reason: z.enum(['identified', 'ambiguous', 'no_place', 'unreadable']),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.reason === 'identified') !== (value.place !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Place/reason mismatch',
      });
    }
  });
export type Extraction = z.infer<typeof extractionSchema>;
export const requestSchema = z
  .object({ saved_item_id: z.string().uuid() })
  .strict();
export type Claim =
  | { state: 'claimed'; image_path: string | null }
  | { state: 'cached'; result: unknown }
  | { state: 'not_found' | 'not_pending' | 'busy' | 'limited' };
export interface Repository {
  claim(userId: string, itemId: string, token: string): Promise<Claim>;
  image(path: string): Promise<Blob>;
  finish(
    userId: string,
    itemId: string,
    token: string,
    result: Extraction,
  ): Promise<boolean>;
  release(userId: string, itemId: string, token: string): Promise<void>;
}
export interface Dependencies {
  authenticate(token: string): Promise<string | null>;
  repository: Repository;
  extract(image: Uint8Array, mime: string): Promise<unknown>;
}
