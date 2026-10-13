import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createHandler } from '../supabase/functions/extract-place/handler.ts';
import {
  extractionSchema,
  Extraction,
} from '../supabase/functions/_shared/contracts.ts';
import {
  MAX_IMAGE_BYTES,
  validateImage,
} from '../supabase/functions/_shared/io.ts';
import { labelsSchema, score } from './scoring.ts';
import { MemoryRepository } from './support.ts';
const fixture = Deno.args[0] === '--fixture';
const folder = fixture
  ? (Deno.args[1] ?? 'eval/cases')
  : (Deno.args[0] ?? 'eval/cases');
const labels = labelsSchema.parse(
  JSON.parse(await Deno.readTextFile(`${folder}/labels.json`)),
);
const scripts = fixture
  ? z
      .record(extractionSchema)
      .parse(
        JSON.parse(await Deno.readTextFile(`${folder}/fixture-responses.json`)),
      )
  : null;
const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Configure ${name}`);
  return v;
};
const live = fixture
  ? null
  : createClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${env('EVAL_USER_JWT')}` } },
    });
const userId = live
  ? (await live.auth.getUser(env('EVAL_USER_JWT'))).data.user?.id
  : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
if (!userId) throw new Error('Evaluation user must be authenticated');
const failures: Record<string, number> = {};
let correct = 0,
  positiveCorrect = 0,
  positiveTotal = 0,
  negativeCorrect = 0,
  negativeTotal = 0,
  categoryCorrect = 0,
  categoryTotal = 0,
  cleanupFailures = 0;
console.log(
  fixture
    ? 'FIXTURE TRANSPORT CHECK - scripted responses; NOT measured vision accuracy'
    : `LIVE VISION EVALUATION (${labels.set_kind})`,
);
for (const label of labels.cases) {
  const id = crypto.randomUUID(),
    ext = label.file.split('.').pop()!.toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const path = `${userId}/${id}/image.${ext}`;
  let inserted = false,
    uploaded = false,
    result: Extraction | null = null,
    error: string | null = null;
  try {
    const fileInfo = await Deno.stat(`${folder}/${label.file}`);
    if (fileInfo.size > MAX_IMAGE_BYTES) throw new Error('invalid_image');
    const bytes = await Deno.readFile(`${folder}/${label.file}`);
    validateImage(bytes, mime);
    const blob = new Blob([bytes], { type: mime });
    let response: Response;
    if (fixture) {
      const repository = new MemoryRepository();
      repository.add(userId, id, blob);
      const handler = createHandler({
        repository,
        authenticate: (t) =>
          Promise.resolve(t === 'fixture-token' ? userId : null),
        extract: () => Promise.resolve(scripts![label.id]),
      });
      response = await handler(
        new Request('http://fixture/extract-place', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer fixture-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ saved_item_id: id }),
        }),
      );
    } else {
      const insert = await live!.from('saved_items').insert({
        id,
        user_id: userId,
        image_url: path,
        source_app: 'evaluation',
      });
      if (insert.error) throw new Error('insert_failed');
      inserted = true;
      const upload = await live!.storage
        .from('captures')
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upload.error) throw new Error('upload_failed');
      uploaded = true;
      response = await fetch(
        `${env('SUPABASE_URL')}/functions/v1/extract-place`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(45000),
          headers: {
            Authorization: `Bearer ${env('EVAL_USER_JWT')}`,
            apikey: env('SUPABASE_PUBLISHABLE_KEY'),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ saved_item_id: id }),
        },
      );
    }
    if (!response.ok) {
      error = `http_${response.status}`;
      await response.body?.cancel();
    } else result = extractionSchema.parse((await response.json()).result);
  } catch {
    error = 'transport_or_validation';
  } finally {
    if (live && uploaded) {
      try {
        const cleanup = await live.storage.from('captures').remove([path]);
        if (cleanup.error) cleanupFailures++;
      } catch {
        cleanupFailures++;
      }
    }
    if (live && inserted) {
      try {
        const cleanup = await live.from('saved_items').delete().eq('id', id);
        if (cleanup.error) cleanupFailures++;
      } catch {
        cleanupFailures++;
      }
    }
  }
  const outcome = result
    ? score(label, result)
    : { correct: false, failure: error ?? 'missing_result' };
  if (outcome.correct) correct++;
  else failures[outcome.failure!] = (failures[outcome.failure!] ?? 0) + 1;
  if (label.expected.reason === 'identified') {
    positiveTotal++;
    if (outcome.correct) positiveCorrect++;
  } else {
    negativeTotal++;
    if (outcome.correct) negativeCorrect++;
  }
  if (label.expected.category) {
    categoryTotal++;
    if (result?.place?.category === label.expected.category) categoryCorrect++;
  }
  console.log(
    `${label.id}: ${outcome.correct ? 'PASS' : `FAIL (${outcome.failure})`}`,
  );
}
const rate = positiveTotal ? positiveCorrect / positiveTotal : 0;
const transportFailed = Object.keys(failures).some(
  (key) => key.startsWith('http_') || key === 'transport_or_validation',
);
const realEligible =
  !fixture &&
  labels.set_kind === 'real' &&
  labels.cases.length >= 50 &&
  positiveTotal >= 40;
const passed =
  rate >= 0.8 &&
  correct / labels.cases.length >= 0.8 &&
  !transportFailed &&
  cleanupFailures === 0;
console.log(
  JSON.stringify(
    {
      mode: fixture ? 'scripted-fixture' : 'live',
      set_kind: labels.set_kind,
      cases: labels.cases.length,
      correct,
      overall_accuracy: correct / labels.cases.length,
      place_identification_accuracy: rate,
      positive_cases: positiveTotal,
      negative_correct: negativeCorrect,
      negative_cases: negativeTotal,
      category_correct: categoryCorrect,
      category_cases: categoryTotal,
      failure_patterns: failures,
      cleanup_failures: cleanupFailures,
      real_gate: realEligible ? (passed ? 'PASS' : 'FAIL') : 'NOT_ESTABLISHED',
    },
    null,
    2,
  ),
);
if (
  (fixture && correct !== labels.cases.length) ||
  cleanupFailures > 0 ||
  (!fixture && !passed)
)
  Deno.exit(1);
