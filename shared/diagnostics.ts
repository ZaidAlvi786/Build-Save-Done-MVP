import { z } from 'zod';
export const diagnosticSchema = z
  .object({
    id: z.string().uuid(),
    code: z.enum([
      'render',
      'auth',
      'capture',
      'confirmation',
      'reminder',
      'retention',
    ]),
    release: z.literal('0.1.0'),
  })
  .strict();
export type Diagnostic = z.infer<typeof diagnosticSchema>;
