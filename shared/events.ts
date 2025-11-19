import { z } from 'zod';
export const eventNames = [
  'app_opened',
  'share_received',
  'extraction_succeeded',
  'extraction_failed',
  'place_confirmed',
  'place_corrected',
  'reminder_sent',
  'reminder_action',
] as const;
export const eventPropertiesSchema = z
  .object({
    item_id: z.string().uuid().optional(),
    reminder_id: z.string().uuid().optional(),
    source: z
      .enum(['share', 'gallery', 'manual', 'geofence', 'snooze', 'digest'])
      .optional(),
    action: z.enum(['navigate', 'snooze', 'been_there']).optional(),
    reason: z.enum(['unidentified', 'unavailable']).optional(),
    category: z
      .enum(['restaurant', 'cafe', 'shop', 'attraction', 'other'])
      .optional(),
    corrected: z.boolean().optional(),
  })
  .strict();
export const eventSchema = z
  .object({
    id: z.string().uuid(),
    event: z.enum(eventNames),
    timestamp: z.string().datetime(),
    properties: eventPropertiesSchema,
  })
  .strict();
export type FunnelEvent = z.infer<typeof eventSchema>;
export type EventProperties = z.infer<typeof eventPropertiesSchema>;
export type EventName = FunnelEvent['event'];
