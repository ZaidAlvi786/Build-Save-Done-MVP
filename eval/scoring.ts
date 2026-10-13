import { z } from 'zod';
import { Extraction } from '../supabase/functions/_shared/contracts.ts';
export const labelsSchema = z
  .object({
    set_kind: z.enum(['synthetic', 'real']),
    cases: z
      .array(
        z.object({
          id: z.string().min(1),
          file: z.string().regex(/^[^/\\]+\.(png|jpe?g|webp)$/i),
          expected: z
            .object({
              names: z.array(z.string().min(1)),
              area: z.string().nullable(),
              category: z
                .enum(['restaurant', 'cafe', 'shop', 'attraction', 'other'])
                .nullable(),
              reason: z.enum([
                'identified',
                'ambiguous',
                'no_place',
                'unreadable',
              ]),
            })
            .strict(),
        }),
      )
      .min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.cases.map((c) => c.id)).size !== value.cases.length ||
      new Set(value.cases.map((c) => c.file)).size !== value.cases.length
    )
      ctx.addIssue({ code: 'custom', message: 'Duplicate cases' });
    for (const c of value.cases)
      if ((c.expected.reason === 'identified') !== c.expected.names.length > 0)
        ctx.addIssue({ code: 'custom', message: 'Invalid identity label' });
  });
export type Label = z.infer<typeof labelsSchema>['cases'][number];
const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
export function score(
  label: Label,
  result: Extraction,
): { correct: boolean; failure: string | null } {
  if (label.expected.reason !== 'identified')
    return {
      correct: result.place === null && result.reason === label.expected.reason,
      failure: result.place
        ? 'false_positive'
        : result.reason === label.expected.reason
          ? null
          : 'wrong_abstention',
    };
  if (!result.place) return { correct: false, failure: 'missed_place' };
  if (
    !label.expected.names.some(
      (n) => normalize(n) === normalize(result.place!.name),
    )
  )
    return { correct: false, failure: 'wrong_name' };
  if (
    label.expected.area &&
    normalize(label.expected.area) !== normalize(result.place.area ?? '')
  )
    return { correct: false, failure: 'wrong_or_missing_area' };
  if (!label.expected.area && result.place.area !== null)
    return { correct: false, failure: 'invented_area' };
  return { correct: true, failure: null };
}
