import assert from 'node:assert/strict';
import { createLocalDb } from './local-db.mjs';
const db = await createLocalDb();
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IA = '11111111-1111-4111-8111-111111111111',
  IB = '22222222-2222-4222-8222-222222222222';
const PA = '33333333-3333-4333-8333-333333333333',
  PB = '44444444-4444-4444-8444-444444444444';
for (const [user, item, place] of [
  [A, IA, PA],
  [B, IB, PB],
]) {
  await db.query('insert into auth.users(id,email) values($1,$2)', [
    user,
    `${user}@test.invalid`,
  ]);
  await db.query(
    'insert into public.saved_items(id,user_id,image_url) values($1,$2,$3)',
    [item, user, `${user}/${item}/image.png`],
  );
  await db.query(
    "insert into public.places(id,saved_item_id,name,address,lat,lng,category,confidence) values($1,$2,'Test Cafe','Test area',31.5,74.3,'cafe',.9)",
    [place, item],
  );
  await db.query('insert into public.reminders(place_id) values($1)', [place]);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('captures',$1)",
    [`${user}/${item}/image.png`],
  );
}
let checks = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};
async function scalar(sql, args = []) {
  const r = await db.query(sql, args);
  return Object.values(r.rows[0])[0];
}
async function deny(sql, args = []) {
  await assert.rejects(db.query(sql, args), { code: '42501' });
  checks++;
}
try {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: A, role: 'authenticated' }),
  ]);
  for (const table of ['users', 'saved_items', 'places', 'reminders'])
    check(
      await scalar(`select count(*)::int from public.${table}`),
      1,
      `A reads only own ${table}`,
    );
  check(
    await scalar(
      "select count(*)::int from storage.objects where bucket_id='captures'",
    ),
    1,
    'A reads only own image',
  );
  check(
    await scalar(
      'select count(*)::int from public.saved_items where user_id=$1',
      [B],
    ),
    0,
    'A cannot read B',
  );
  await deny('insert into public.saved_items(id,user_id) values($1,$2)', [
    crypto.randomUUID(),
    B,
  ]);
  await deny(
    "insert into public.places(saved_item_id,name,address,lat,lng,category,confidence) values($1,'attack','x',1,1,'cafe',.9)",
    [IB],
  );
  await deny(
    "insert into storage.objects(bucket_id,name) values('captures',$1)",
    [`${B}/attack/image.png`],
  );
  await deny('update public.saved_items set user_id=$1 where id=$2', [B, IA]);
  await deny("update public.saved_items set raw_ai_json='{}' where id=$1", [
    IA,
  ]);
  await deny('update public.saved_items set created_at=now() where id=$1', [
    IA,
  ]);
  await deny('update public.users set extraction_limit=100 where id=$1', [A]);
  await deny('select public.claim_extraction($1,$2,$3)', [
    A,
    IA,
    crypto.randomUUID(),
  ]);
  check(
    await scalar(
      "with changed as (update public.saved_items set status='dismissed' where id=$1 returning id) select count(*)::int from changed",
      [IB],
    ),
    0,
    'A cannot change B',
  );
  await db.exec('reset role');
  await db.query('update public.users set extraction_limit=1 where id=$1', [A]);
  const token = crypto.randomUUID();
  const claim = async (user, item, t = crypto.randomUUID()) =>
    await scalar("select public.claim_extraction($1,$2,$3)->>'state'", [
      user,
      item,
      t,
    ]);
  check(await claim(A, IB), 'not_found', 'service RPC checks ownership');
  check(await claim(A, IA, token), 'claimed', 'first lease');
  check(await claim(A, IA), 'busy', 'concurrent claim');
  check(
    await scalar('select public.finish_extraction($1,$2,$3,$4::jsonb)', [
      A,
      IA,
      crypto.randomUUID(),
      '{"place":null,"reason":"no_place"}',
    ]),
    false,
    'stale fenced write rejected',
  );
  check(
    await scalar('select public.finish_extraction($1,$2,$3,$4::jsonb)', [
      A,
      IA,
      token,
      '{"place":null,"reason":"no_place"}',
    ]),
    true,
    'correct fenced write',
  );
  check(await claim(A, IA), 'cached', 'idempotent replay');
  const next = crypto.randomUUID();
  await db.query('insert into public.saved_items(id,user_id) values($1,$2)', [
    next,
    A,
  ]);
  check(await claim(A, next), 'limited', 'per-user rate limit');
  check(await claim(B, IB), 'claimed', 'other user quota independent');
  check(
    await scalar('select status from public.saved_items where id=$1', [IA]),
    'pending',
    'no automatic confirmation',
  );
  check(
    await scalar(
      "select count(*)::int from pg_indexes where schemaname='public' and indexname='places_location'",
    ),
    1,
    'geospatial index exists',
  );
  check(
    await scalar(
      'select extensions.st_y(location::extensions.geometry) from public.places where id=$1',
      [PA],
    ),
    31.5,
    'geography generated correctly',
  );
  // Expiry and stale cleanup must not release a replacement lease.
  await db.query(
    "update public.users set extraction_window_start=now()-interval '2 hours' where id=$1",
    [A],
  );
  check(await claim(A, next, token), 'claimed', 'hour quota reset');
  await db.query(
    "update public.saved_items set extraction_lease_until=now()-interval '1 second' where id=$1",
    [next],
  );
  await db.query('update public.users set extraction_limit=2 where id=$1', [A]);
  const replacement = crypto.randomUUID();
  check(await claim(A, next, replacement), 'claimed', 'expired lease replaced');
  await db.query('select public.release_extraction($1,$2,$3)', [
    A,
    next,
    token,
  ]);
  check(await claim(A, next), 'busy', 'stale cleanup preserves new lease');
  const manual = crypto.randomUUID();
  await db.query('insert into public.saved_items(id,user_id) values($1,$2)', [
    manual,
    A,
  ]);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: A, role: 'authenticated' }),
  ]);
  const confirmSql = 'select public.confirm_place($1,$2,$3,$4,$5,$6,$7,$8)';
  await deny(confirmSql, [
    IB,
    'My cafe',
    'My area',
    31.5,
    74.3,
    'cafe',
    0.9,
    'provider-id',
  ]);
  await assert.rejects(
    db.query(confirmSql, [
      manual,
      'My cafe',
      'My area',
      100,
      74.3,
      'cafe',
      0.9,
      'provider-id',
    ]),
    { code: '23514' },
  );
  checks++;
  check(
    await scalar('select status from public.saved_items where id=$1', [manual]),
    'pending',
    'failed confirmation keeps pending status',
  );
  check(
    await scalar(
      'select count(*)::int from public.places where saved_item_id=$1',
      [manual],
    ),
    0,
    'failed confirmation rolls back place',
  );
  const confirmedId = await scalar(confirmSql, [
    manual,
    'My cafe',
    'My area',
    31.5,
    74.3,
    'cafe',
    0.9,
    'provider-id',
  ]);
  check(
    await scalar('select status from public.saved_items where id=$1', [manual]),
    'confirmed',
    'confirmation is atomic',
  );
  check(
    await scalar(confirmSql, [
      manual,
      'Changed name',
      'Other area',
      32,
      75,
      'shop',
      0.1,
      'different-id',
    ]),
    confirmedId,
    'confirmation replay is idempotent',
  );
  check(
    await scalar('select name from public.places where saved_item_id=$1', [
      manual,
    ]),
    'My cafe',
    'replay does not overwrite chosen place',
  );
  await db.exec('reset role');
  await db.query(
    "update public.places set coordinates_expire_at=now()-interval '1 second' where saved_item_id=$1",
    [manual],
  );
  await db.query('select public.expire_place_coordinates()');
  check(
    await scalar('select lat from public.places where saved_item_id=$1', [
      manual,
    ]),
    null,
    'expired Google coordinates cleared',
  );
  check(
    await scalar('select name from public.places where saved_item_id=$1', [
      manual,
    ]),
    'My cafe',
    'expiry preserves saved intent',
  );
  await db.exec('set role authenticated');
  const reminderId = crypto.randomUUID(),
    sentAt = new Date().toISOString();
  const reminderSql = 'select public.record_reminder($1,$2,$3,$4,$5)';
  await deny(reminderSql, [
    crypto.randomUUID(),
    PB,
    sentAt,
    'navigate',
    sentAt,
  ]);
  check(
    await scalar(reminderSql, [
      reminderId,
      confirmedId,
      sentAt,
      'ignored',
      null,
    ]),
    'ignored',
    'reminder sent is recorded',
  );
  check(
    await scalar(reminderSql, [
      reminderId,
      confirmedId,
      sentAt,
      'navigate',
      sentAt,
    ]),
    'navigate',
    'offline action updates sent reminder',
  );
  check(
    await scalar(reminderSql, [
      reminderId,
      confirmedId,
      sentAt,
      'been_there',
      sentAt,
    ]),
    'navigate',
    'first explicit action wins on replay',
  );
  check(
    await scalar('select count(*)::int from public.reminders where id=$1', [
      reminderId,
    ]),
    1,
    'one reminder row after retries',
  );
  await deny('update public.reminders set action=$1 where id=$2', [
    'snooze',
    reminderId,
  ]);
  await deny('insert into public.reminders(place_id) values($1)', [
    confirmedId,
  ]);
  await deny(reminderSql, [reminderId, PA, sentAt, 'snooze', sentAt]);
  await deny('select public.refresh_place_coordinates($1,$2,$3,$4)', [
    A,
    confirmedId,
    1,
    2,
  ]);
  check(
    await scalar(reminderSql, [
      crypto.randomUUID(),
      confirmedId,
      sentAt,
      'been_there',
      sentAt,
    ]),
    'been_there',
    'been there is logged',
  );
  check(
    await scalar('select status from public.saved_items where id=$1', [manual]),
    'visited',
    'been there atomically marks saved item visited',
  );
  await db.exec('reset role');
  check(
    await scalar('select public.refresh_place_coordinates($1,$2,$3,$4)', [
      A,
      PB,
      1,
      2,
    ]),
    false,
    'service refresh checks owner',
  );
  check(
    await scalar('select public.refresh_place_coordinates($1,$2,$3,$4)', [
      A,
      confirmedId,
      31.5,
      74.3,
    ]),
    true,
    'service refresh restores own coordinates',
  );
  check(
    await scalar(
      'select coordinates_expire_at>now() from public.places where id=$1',
      [confirmedId],
    ),
    true,
    'refreshed coordinates have future expiry',
  );
  await db.query('select public.begin_account_deletion($1)', [A]);
  await db.exec('set role authenticated');
  await deny('insert into public.saved_items(id,user_id) values($1,$2)', [
    crypto.randomUUID(),
    A,
  ]);
  await deny(
    "insert into storage.objects(bucket_id,name) values('captures',$1)",
    [`${A}/${next}/image.png`],
  );
  await deny(confirmSql, [
    next,
    'My cafe',
    'My area',
    31.5,
    74.3,
    'cafe',
    0.9,
    'provider-id',
  ]);
  await db.exec('reset role');
  check(
    await claim(A, next),
    'not_found',
    'deleting account cannot invoke extraction',
  );
  check(
    await scalar('select public.consume_matching_quota($1,$2)', [A, next]),
    false,
    'deleting account cannot invoke matching',
  );
  const imagePaths = await db.query(
    'select name from public.account_capture_paths($1)',
    [A],
  );
  check(
    imagePaths.rows.length,
    1,
    'deletion enumerates only own images including orphans',
  );
  await db.query(
    "delete from storage.objects where bucket_id='captures' and name like $1",
    [`${A}/%`],
  );
  await db.query('delete from auth.users where id=$1', [A]);
  for (const table of ['users', 'saved_items', 'places', 'reminders'])
    check(
      await scalar(`select count(*)::int from public.${table}`),
      1,
      `delete cascades A ${table} and preserves B`,
    );
  console.log(
    `${checks} local Postgres/PostGIS migration, RLS and lease checks passed.`,
  );
  console.log(
    'Supabase Auth/Storage HTTP integration and pgTAP suite still require Docker.',
  );
} finally {
  await db.close();
}
