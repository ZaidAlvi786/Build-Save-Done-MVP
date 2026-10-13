-- Run after creating Vault secrets saved_done_project_url and saved_done_digest_cron_secret.
-- No credential literals belong in this file. Do not run against a project without review.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='saved_done_project_url' and decrypted_secret ~ '^https://[A-Za-z0-9-]+\.supabase\.co$') or not exists(select 1 from vault.decrypted_secrets where name='saved_done_digest_cron_secret' and length(decrypted_secret)>=32) then raise exception 'Configure digest Vault secrets before scheduling';end if;
 if exists(select 1 from cron.job where jobname='saved-done-weekly-digest') then perform cron.unschedule('saved-done-weekly-digest');end if;
 perform cron.schedule('saved-done-weekly-digest','*/10 * * * *',$job$
  select net.http_post(url:=(select decrypted_secret from vault.decrypted_secrets where name='saved_done_project_url')||'/functions/v1/weekly-digest',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='saved_done_digest_cron_secret')),body:='{}'::jsonb,timeout_milliseconds:=30000);
 $job$);
end; $$;
