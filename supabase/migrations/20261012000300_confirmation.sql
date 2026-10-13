alter table public.users add column deletion_requested boolean not null default false;
alter table public.saved_items add column source_text text check(length(source_text)<=8000);
grant insert(source_text) on public.saved_items to authenticated;
alter table public.users add column matching_window_start timestamptz not null default now();
alter table public.users add column matching_attempts integer not null default 0;
alter table public.places add column provider_place_id text;
alter table public.places add column coordinates_expire_at timestamptz;

create function public.consume_matching_quota(p_user_id uuid,p_item_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare u public.users;
begin
 select * into u from public.users where id=p_user_id for update;
 if not found or u.deletion_requested or not exists(select 1 from public.saved_items where id=p_item_id and user_id=p_user_id) then return false; end if;
 if u.matching_window_start <= now()-interval '1 hour' then
  update public.users set matching_window_start=now(),matching_attempts=0 where id=p_user_id;
  u.matching_attempts:=0;
 end if;
 if u.matching_attempts >= 60 then return false; end if;
 update public.users set matching_attempts=matching_attempts+1 where id=p_user_id;
 return true;
end; $$;
revoke all on function public.consume_matching_quota(uuid,uuid) from public,anon,authenticated;
grant execute on function public.consume_matching_quota(uuid,uuid) to service_role;

-- A single transaction writes the selected place and confirmation state.
create function public.confirm_place(p_item_id uuid,p_name text,p_address text,p_lat double precision,p_lng double precision,p_category text,p_confidence double precision,p_provider_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.saved_items; place_id uuid;
begin
 if not exists(select 1 from public.users where id=auth.uid() and not deletion_requested) then raise exception 'account_unavailable' using errcode='42501'; end if;
 select * into s from public.saved_items where id=p_item_id and user_id=auth.uid() for update;
 if not found then raise exception 'item_not_found' using errcode='42501'; end if;
 if s.status='confirmed' then
  select id into place_id from public.places where saved_item_id=p_item_id;
  if place_id is null then raise exception 'missing_place'; end if;
  return place_id;
 end if;
 if s.status<>'pending' then raise exception 'item_not_pending'; end if;
 if p_provider_id is null or length(p_provider_id) not between 1 and 300 then raise exception 'invalid_provider_id'; end if;
 insert into public.places(saved_item_id,name,address,lat,lng,category,confidence,provider_place_id,coordinates_expire_at)
 values(p_item_id,trim(p_name),trim(p_address),p_lat,p_lng,p_category,p_confidence,p_provider_id,now()+interval '29 days') returning id into place_id;
 update public.saved_items set status='confirmed',extraction_token=null,extraction_lease_until=null where id=p_item_id;
 return place_id;
end; $$;
revoke all on function public.confirm_place(uuid,text,text,double precision,double precision,text,double precision,text) from public,anon;
grant execute on function public.confirm_place(uuid,text,text,double precision,double precision,text,double precision,text) to authenticated;

create function public.account_capture_paths(p_user_id uuid) returns table(name text) language sql security definer set search_path='' as $$
 select o.name from storage.objects o where o.bucket_id='captures' and o.name like p_user_id::text || '/%';
$$;
revoke all on function public.account_capture_paths(uuid) from public,anon,authenticated;
grant execute on function public.account_capture_paths(uuid) to service_role;

drop policy own_items_insert on public.saved_items;
create policy own_items_insert on public.saved_items for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and raw_ai_json is null and exists(select 1 from public.users u where u.id=user_id and not u.deletion_requested));
drop policy own_capture_insert on storage.objects;
create policy own_capture_insert on storage.objects for insert to authenticated with check(bucket_id='captures' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.saved_items s join public.users u on u.id=s.user_id where s.user_id=(select auth.uid()) and not u.deletion_requested and s.id::text=(storage.foldername(name))[2] and s.image_url=name and s.status='pending'));
create function public.begin_account_deletion(p_user_id uuid) returns void language sql security definer set search_path='' as $$ update public.users set deletion_requested=true where id=p_user_id; $$;
revoke all on function public.begin_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;

create or replace function public.claim_extraction(p_user_id uuid,p_item_id uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.users; s public.saved_items;
begin
  -- Always lock in this order, serializing per-user quotas across Edge instances.
  select * into u from public.users where id=p_user_id for update;
  if not found or u.deletion_requested then return jsonb_build_object('state','not_found'); end if;
  select * into s from public.saved_items where id=p_item_id and user_id=p_user_id for update;
  if not found then return jsonb_build_object('state','not_found'); end if;
  if s.raw_ai_json is not null then return jsonb_build_object('state','cached','result',s.raw_ai_json); end if;
  if s.status <> 'pending' then return jsonb_build_object('state','not_pending'); end if;
  if s.extraction_lease_until > now() then return jsonb_build_object('state','busy'); end if;
  if u.extraction_window_start <= now()-interval '1 hour' then
    update public.users set extraction_window_start=now(),extraction_attempts=0 where id=p_user_id;
    u.extraction_attempts:=0;
  end if;
  if u.extraction_attempts >= u.extraction_limit then return jsonb_build_object('state','limited'); end if;
  update public.users set extraction_attempts=extraction_attempts+1 where id=p_user_id;
  update public.saved_items set extraction_token=p_token,extraction_lease_until=now()+interval '90 seconds' where id=p_item_id;
  return jsonb_build_object('state','claimed','image_path',s.image_url);
end; $$;

-- Expired provider coordinates are cleared; the user's saved intent/place ID remains.
alter table public.places alter column lat drop not null;
alter table public.places alter column lng drop not null;
alter table public.places add constraint coordinates_pair check ((lat is null)=(lng is null));
create function public.expire_place_coordinates() returns void language sql security definer set search_path='' as $$
 update public.places set lat=null,lng=null where coordinates_expire_at<=now() and lat is not null;
$$;
revoke all on function public.expire_place_coordinates() from public,anon,authenticated;
grant execute on function public.expire_place_coordinates() to service_role;
-- Supabase provides pg_cron; embedded Postgres tests invoke the job directly.
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
  perform cron.schedule('expire-place-coordinates','0 * * * *','select public.expire_place_coordinates()');
 end if;
end; $$;
