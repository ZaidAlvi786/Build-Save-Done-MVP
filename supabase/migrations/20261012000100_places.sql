create extension if not exists postgis with schema extensions;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text, email text, created_at timestamptz not null default now(),
  reminder_radius_m integer not null default 300 check (reminder_radius_m between 100 and 2000),
  extraction_window_start timestamptz not null default now(),
  extraction_attempts integer not null default 0,
  extraction_limit integer not null default 20 check (extraction_limit between 1 and 100)
);
create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  image_url text, source_app text check (length(source_app) <= 100),
  raw_ai_json jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','visited','dismissed')),
  created_at timestamptz not null default now(),
  extraction_token uuid, extraction_lease_until timestamptz
);
create index saved_items_user_id_created_at on public.saved_items(user_id, created_at);
create table public.places (
  id uuid primary key default gen_random_uuid(),
  saved_item_id uuid not null unique references public.saved_items(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  address text not null check (length(address) <= 500),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  category text not null check (category in ('restaurant','cafe','shop','attraction','other')),
  confidence double precision not null check (confidence between 0 and 1),
  location extensions.geography(Point,4326) generated always as
    (extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)::extensions.geography) stored
);
create index places_location on public.places using gist(location);
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  sent_at timestamptz not null default now(),
  action text not null default 'ignored' check(action in ('navigate','snooze','been_there','ignored')),
  action_at timestamptz
);
create index reminders_place_id_sent_at on public.reminders(place_id,sent_at);

create function public.create_user_profile() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.users(id,email,phone) values(new.id,new.email,new.phone);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_user_profile();
insert into public.users(id,email,phone) select id,email,phone from auth.users on conflict do nothing;

alter table public.users enable row level security;
alter table public.saved_items enable row level security;
alter table public.places enable row level security;
alter table public.reminders enable row level security;
create policy own_profile_read on public.users for select to authenticated using(id=(select auth.uid()));
create policy own_profile_update on public.users for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy own_items_read on public.saved_items for select to authenticated using(user_id=(select auth.uid()));
create policy own_items_insert on public.saved_items for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and raw_ai_json is null);
create policy own_items_update on public.saved_items for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_items_delete on public.saved_items for delete to authenticated using(user_id=(select auth.uid()));
create policy own_places on public.places for all to authenticated using(exists(select 1 from public.saved_items s where s.id=saved_item_id and s.user_id=(select auth.uid()))) with check(exists(select 1 from public.saved_items s where s.id=saved_item_id and s.user_id=(select auth.uid())));
create policy own_reminders on public.reminders for all to authenticated using(exists(select 1 from public.places p join public.saved_items s on s.id=p.saved_item_id where p.id=place_id and s.user_id=(select auth.uid()))) with check(exists(select 1 from public.places p join public.saved_items s on s.id=p.saved_item_id where p.id=place_id and s.user_id=(select auth.uid())));

-- No client can alter AI cache, leases, quota, identity or first-save time.
revoke all on public.users,public.saved_items,public.places,public.reminders from anon,authenticated;
grant select on public.users,public.saved_items,public.places,public.reminders to authenticated;
grant update(reminder_radius_m) on public.users to authenticated;
grant insert(id,user_id,image_url,source_app) on public.saved_items to authenticated;
grant update(status) on public.saved_items to authenticated;
grant delete on public.saved_items to authenticated;
grant insert(id,saved_item_id,name,address,lat,lng,category,confidence) on public.places to authenticated;
grant update(name,address,lat,lng,category,confidence) on public.places to authenticated;
grant delete on public.places to authenticated;
grant insert(id,place_id,sent_at,action,action_at) on public.reminders to authenticated;
grant update(action,action_at) on public.reminders to authenticated;
grant all on public.users,public.saved_items,public.places,public.reminders to service_role;
revoke all on function public.create_user_profile() from public;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('captures','captures',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy own_capture_read on storage.objects for select to authenticated using(bucket_id='captures' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy own_capture_insert on storage.objects for insert to authenticated with check(bucket_id='captures' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.saved_items s where s.user_id=(select auth.uid()) and s.id::text=(storage.foldername(name))[2] and s.image_url=name and s.status='pending'));
create policy own_capture_delete on storage.objects for delete to authenticated using(bucket_id='captures' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- No UPDATE/upsert policy: captures cannot be swapped under an extraction lease.
