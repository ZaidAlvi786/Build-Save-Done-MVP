import { score, Label, labelsSchema } from './scoring.ts';
import { equal, assert } from './support.ts';
const label: Label = {
  id: 'a',
  file: 'a.png',
  expected: {
    names: ['Juniper Cafe'],
    area: 'Lahore',
    category: 'cafe',
    reason: 'identified',
  },
};
const place = {
  name: 'JUNIPER Cafe',
  area: 'Lahore',
  address: null,
  category: 'cafe' as const,
  confidence: 0.9,
};
Deno.test(
  'accuracy requires exact normalized identity and location, not fuzzy overlap',
  () => {
    equal(score(label, { place, reason: 'identified' }).correct, true);
    equal(
      score(label, {
        place: { ...place, name: 'Juniper Cafe Express' },
        reason: 'identified',
      }).failure,
      'wrong_name',
    );
    equal(
      score(label, {
        place: { ...place, area: 'Karachi' },
        reason: 'identified',
      }).failure,
      'wrong_or_missing_area',
    );
    equal(
      score(label, { place: null, reason: 'no_place' }).failure,
      'missed_place',
    );
  },
);
Deno.test('negative cases and label paths cannot silently pass', () => {
  equal(
    score(
      {
        ...label,
        expected: {
          names: [],
          area: null,
          category: null,
          reason: 'ambiguous',
        },
      },
      { place, reason: 'identified' },
    ).failure,
    'false_positive',
  );
  assert(
    !labelsSchema.safeParse({
      set_kind: 'real',
      cases: [{ ...label, file: '../a.png' }],
    }).success,
  );
  assert(
    !labelsSchema.safeParse({ set_kind: 'real', cases: [label, label] })
      .success,
  );
});
