import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { readFile, readdir } from 'node:fs/promises';
export async function createLocalDb() {
  const db = await PGlite.create({ extensions: { postgis } });
  // Only managed Supabase schemas are represented here. Product migrations are
  // applied unchanged. This proves Postgres policies, not GoTrue/Storage HTTP.
  await db.exec(`
 set time zone 'UTC';
 create role anon;
 create role authenticated;
 create role service_role bypassrls;
 create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,email text,phone text);
 create function auth.uid() returns uuid language sql stable as
 $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text unique);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as
 $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
 grant usage on schema public,auth,storage,extensions to anon,authenticated,service_role;
 grant select,insert,update,delete on storage.objects to authenticated;
 grant select on storage.buckets to authenticated;
`);
  for (const name of (await readdir('supabase/migrations'))
    .filter((n) => n.endsWith('.sql'))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
  return db;
}
