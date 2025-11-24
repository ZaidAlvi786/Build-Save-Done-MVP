begin;
create extension if not exists pgtap with schema extensions;
select plan(22);
insert into auth.users(id,email) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a@test.invalid'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b@test.invalid');
insert into public.saved_items(id,user_id,image_url) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111/a.png'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/22222222-2222-4222-8222-222222222222/b.png');
insert into public.places(id,saved_item_id,name,address,lat,lng,category,confidence) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','A Cafe','Lahore',31.5,74.3,'cafe',.9),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','B Cafe','Karachi',24.8,67.0,'cafe',.9);
insert into public.reminders(place_id) values ('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
insert into storage.objects(bucket_id,name) select 'captures',image_url from public.saved_items;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select is((select count(*)::integer from public.users),1,'A reads only own profile');
select is((select count(*)::integer from public.saved_items),1,'A cannot read B saved items');
select is((select count(*)::integer from public.places),1,'A cannot read B places');
select is((select count(*)::integer from public.reminders),1,'A cannot read B reminders');
select is((select count(*)::integer from storage.objects where bucket_id='captures'),1,'A cannot read B images');
select is((select count(*)::integer from public.saved_items where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),0,'explicit B query returns no data');
select throws_ok($$insert into public.saved_items(id,user_id) values(gen_random_uuid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,'42501',null,'A cannot create B item');
select throws_ok($$insert into public.places(saved_item_id,name,address,lat,lng,category,confidence) values('22222222-2222-4222-8222-222222222222','attack','x',1,1,'cafe',.9)$$,'42501',null,'A cannot write B place');
select throws_ok($$insert into storage.objects(bucket_id,name) values('captures','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/attack.png')$$,'42501',null,'A cannot upload to B folder');
select ok(not has_column_privilege('authenticated','public.saved_items','raw_ai_json','UPDATE'),'client cannot forge AI cache');
select ok(not has_column_privilege('authenticated','public.saved_items','user_id','UPDATE'),'ownership immutable');
select ok(not has_column_privilege('authenticated','public.saved_items','created_at','UPDATE'),'first-save timestamp immutable');
select ok(not has_column_privilege('authenticated','public.users','extraction_limit','UPDATE'),'quota is server controlled');
select ok(not has_function_privilege('authenticated','public.claim_extraction(uuid,uuid,uuid)','EXECUTE'),'claim RPC inaccessible to client');
reset role;
update public.users set extraction_limit=1 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(public.claim_extraction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',gen_random_uuid())->>'state','not_found','privileged RPC still enforces ownership');
select is(public.claim_extraction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555')->>'state','claimed','first request claims lease');
select is(public.claim_extraction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',gen_random_uuid())->>'state','busy','duplicate concurrent claim is busy');
select is(public.finish_extraction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',gen_random_uuid(),'{"place":null,"reason":"no_place"}'),false,'stale token cannot write');
select is(public.finish_extraction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','{"place":null,"reason":"no_place"}'),true,'current token writes once');
select is(public.claim_extraction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',gen_random_uuid())->>'state','cached','cached result bypasses spent quota');
insert into public.saved_items(id,user_id) values('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select is(public.claim_extraction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666',gen_random_uuid())->>'state','limited','next item rate limited');
select is((select status from public.saved_items where id='11111111-1111-4111-8111-111111111111'),'pending','AI never auto-confirms place');
select * from finish();
rollback;
