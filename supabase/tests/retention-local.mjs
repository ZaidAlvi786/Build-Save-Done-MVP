import assert from 'node:assert/strict';
import { createLocalDb } from './local-db.mjs';
const db = await createLocalDb();
let checks = 0;
const A = crypto.randomUUID(),
  B = crypto.randomUUID(),
  C = crypto.randomUUID(),
  D = crypto.randomUUID(),
  installation = crypto.randomUUID(),
  otherInstallation = crypto.randomUUID();
const item = crypto.randomUUID(),
  place = crypto.randomUUID(),
  foreignItem = crypto.randomUUID(),
  foreignPlace = crypto.randomUUID();
const check = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
async function scalar(sql, args = []) {
  return Object.values((await db.query(sql, args)).rows[0])[0];
}
async function actor(uid) {
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: uid }),
  ]);
}
async function rejected(sql, args = [], code = '42501') {
  await assert.rejects(db.query(sql, args), { code });
  checks++;
}
try {
  for (const uid of [A, B, C, D])
    await db.query('insert into auth.users(id) values($1)', [uid]);
  check((await db.query('select * from public.success_metric()')).rows[0], {
    eligible_users: 0,
    successful_users: 0,
    success_rate: null,
    target_met: false,
  });
  for (const [uid, id, age] of [
    [A, item, 10],
    [B, foreignItem, 10],
    [C, crypto.randomUUID(), 10],
    [D, crypto.randomUUID(), 1],
  ])
    await db.query(
      "insert into public.saved_items(id,user_id,created_at,status) values($1,$2,now()-($3||' days')::interval,'confirmed')",
      [id, uid, age],
    );
  for (const [id, saved] of [
    [place, item],
    [foreignPlace, foreignItem],
  ])
    await db.query(
      "insert into public.places(id,saved_item_id,name,address,lat,lng,category,confidence,coordinates_expire_at) values($1,$2,'Cafe','Area',31,74,'cafe',.9,now()+interval '30 days')",
      [id, saved],
    );
  await db.query(
    "insert into public.reminders(place_id,sent_at,action,action_at) values($1,now()-interval '9 days','snooze',now()-interval '8 days')",
    [foreignPlace],
  );
  check(
    await scalar(
      'select first_reminder_success_at is null from public.users where id=$1',
      [B],
    ),
    true,
  );
  // An offline action delivered days later still qualifies by its action time.
  await db.query(
    "insert into public.reminders(place_id,sent_at,action,action_at) values($1,now()-interval '9 days','navigate',now()-interval '8 days')",
    [place],
  );
  let metric = (await db.query('select * from public.success_metric()'))
    .rows[0];
  check(metric.eligible_users, 3);
  check(metric.successful_users, 1);
  check(metric.target_met, true);
  check(
    Number(metric.success_rate) > 0.333 && Number(metric.success_rate) < 0.334,
    true,
  );
  await db.query('delete from public.saved_items where id=$1', [item]);
  metric = (await db.query('select * from public.success_metric()')).rows[0];
  check(metric.eligible_users, 3);
  check(metric.successful_users, 1);
  const restored = crypto.randomUUID();
  await db.query(
    "insert into public.saved_items(id,user_id,status) values($1,$2,'confirmed')",
    [restored, A],
  );
  await db.query(
    "insert into public.places(id,saved_item_id,name,address,lat,lng,category,confidence,coordinates_expire_at) values($1,$2,'Cafe','Area',31,74,'cafe',.9,now()+interval '30 days')",
    [place, restored],
  );
  check(
    await scalar(
      "select first_saved_at<now()-interval '9 days' from public.users where id=$1",
      [A],
    ),
    true,
  );
  await db.query(
    "insert into public.reminders(place_id,sent_at,action,action_at) select $1,first_saved_at+interval '6 days', 'been_there', first_saved_at+interval '7 days' from public.users where id=$2",
    [foreignPlace, B],
  );
  check(
    await scalar(
      'select first_reminder_success_at is null from public.users where id=$1',
      [B],
    ),
    true,
  );
  await actor(A);
  await rejected('select * from public.success_metric()');
  await rejected('update public.users set first_saved_at=now() where id=$1', [
    A,
  ]);
  await rejected('update public.users set digest_enabled=true where id=$1', [
    A,
  ]);
  await rejected('select public.consume_analytics_quota($1,1)', [A]);
  await db.query('select public.set_analytics_consent(true)');
  await db.exec('reset role');
  check(
    await scalar('select public.consume_analytics_quota($1,20)', [A]),
    'allowed',
  );
  await db.query('update public.users set analytics_attempts=999 where id=$1', [
    A,
  ]);
  check(
    await scalar('select public.consume_analytics_quota($1,2)', [A]),
    'limited',
  );
  check(
    await scalar('select public.consume_analytics_quota($1,1)', [B]),
    'disabled',
  );
  await actor(A);
  const enable =
    "select public.set_digest_preferences(true,$1,'ExpoPushToken[test]','UTC')";
  await db.query(enable, [installation]);
  await rejected('select public.publish_digest_nearby($1,$2)', [
    installation,
    [foreignPlace],
  ]);
  await rejected(
    "select public.set_digest_preferences(true,$1,'ExpoPushToken[test]','Made/Up')",
    [installation],
    'P0001',
  );
  await db.query('select public.publish_digest_nearby($1,$2)', [
    installation,
    [place, place],
  ]);
  check(
    await scalar(
      "select digest_nearby_until between now()+interval '5 hours' and now()+interval '7 hours' from public.users where id=$1",
      [A],
    ),
    true,
  );
  await rejected('select * from public.claim_weekly_digest()');
  check(
    await scalar(
      "select public.refresh_digest_token($1,'ExpoPushToken[other]','UTC')",
      [otherInstallation],
    ),
    false,
  );
  await db.query("select public.set_digest_preferences(false,$1,null,'UTC')", [
    otherInstallation,
  ]);
  check(
    await scalar('select digest_enabled from public.users where id=$1', [A]),
    true,
  );
  await db.exec('reset role');
  const friday = await scalar(
    "select date_trunc('week',now())+interval '4 days 18 hours'",
  );
  await db.query(
    "update public.users set digest_nearby_until=$2::timestamptz+interval '1 hour' where id=$1",
    [A, friday],
  );
  check(
    (
      await db.query(
        "select * from public.claim_weekly_digest($1::timestamptz-interval '1 hour')",
        [friday],
      )
    ).rows.length,
    0,
  );
  const claims = (
    await db.query('select * from public.claim_weekly_digest($1)', [friday])
  ).rows;
  check(claims.length, 1);
  check(claims[0].place_count, 1);
  check(
    (await db.query('select * from public.claim_weekly_digest($1)', [friday]))
      .rows.length,
    0,
  );
  const lease = claims[0].lease_id;
  check(
    await scalar('select public.digest_still_allowed($1,$2)', [A, lease]),
    true,
  );
  await db.query(
    "select public.finish_digest($1,$2,'accepted','ticket',false)",
    [A, lease],
  );
  check(
    (
      await db.query(
        "select * from public.pending_digest_receipts($1::timestamptz+interval '16 minutes')",
        [friday],
      )
    ).rows.length,
    1,
  );
  check(
    (
      await db.query(
        "select * from public.pending_digest_receipts($1::timestamptz+interval '25 hours')",
        [friday],
      )
    ).rows[0].expired,
    true,
  );
  await actor(A);
  await db.query(
    "select public.refresh_digest_token($1,'ExpoPushToken[rotated]','UTC')",
    [installation],
  );
  await db.exec('reset role');
  await db.query(
    "select public.finish_digest($1,$2,'receipt_error',null,true)",
    [A, lease],
  );
  check(
    await scalar('select push_token from public.users where id=$1', [A]),
    'ExpoPushToken[rotated]',
  );
  check(
    await scalar('select public.digest_still_allowed($1,$2)', [A, lease]),
    false,
  );
  await actor(A);
  await db.query("select public.set_digest_preferences(false,$1,null,'UTC')", [
    installation,
  ]);
  check(
    await scalar(
      'select cardinality(digest_nearby_ids) from public.users where id=$1',
      [A],
    ),
    0,
  );
  check(
    await scalar('select push_token is null from public.users where id=$1', [
      A,
    ]),
    true,
  );
  await db.exec('reset role');
  await actor(A);
  await rejected(
    'update public.users set diagnostics_opt_in=true where id=$1',
    [A],
  );
  await rejected('select public.consume_diagnostics_quota($1)', [A]);
  await db.query('select public.set_analytics_consent(false)');
  await db.query('select public.set_diagnostics_consent(true)');
  await db.exec('reset role');
  await db.query('update public.users set analytics_attempts=0 where id=$1', [
    A,
  ]);
  check(
    await scalar('select public.consume_diagnostics_quota($1)', [A]),
    'allowed',
  );
  check(
    await scalar('select public.consume_diagnostics_quota($1)', [B]),
    'disabled',
  );
  check(
    await scalar('select public.consume_analytics_quota($1,1)', [A]),
    'disabled',
  );
  await db.query(
    'update public.users set analytics_attempts=1000 where id=$1',
    [A],
  );
  check(
    await scalar('select public.consume_diagnostics_quota($1)', [A]),
    'limited',
  );
  await db.query('select public.begin_account_deletion($1)', [A]);
  check(
    (await db.query('select * from public.success_metric()')).rows[0]
      .eligible_users,
    2,
  );
  await actor(A);
  await rejected('select public.set_analytics_consent(true)');
  await rejected('select public.set_diagnostics_consent(true)');
  await db.exec('reset role');
  check(
    await scalar('select public.consume_diagnostics_quota($1)', [A]),
    'disabled',
  );
  console.log(
    `${checks} retention cohort, consent, quota, digest ownership and lease checks passed.`,
  );
} finally {
  await db.close();
}
