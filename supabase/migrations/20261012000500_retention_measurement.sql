-- Four product tables remain; cohort and retention metadata live on users.
alter table public.users add column first_saved_at timestamptz;
alter table public.users add column first_reminder_success_at timestamptz;
alter table public.users add column analytics_opt_in boolean not null default false;
alter table public.users add column analytics_window_start timestamptz not null default now();
alter table public.users add column analytics_attempts integer not null default 0;
alter table public.users add column digest_enabled boolean not null default false;
alter table public.users add column digest_timezone text not null default 'UTC';
alter table public.users add column push_token text;
alter table public.users add column push_installation_id uuid;
alter table public.users add column digest_nearby_ids uuid[] not null default '{}';
alter table public.users add column digest_nearby_until timestamptz;
alter table public.users add column digest_last_week date;
alter table public.users add column digest_lease_id uuid;
alter table public.users add column digest_target_token text;
alter table public.users add column digest_target_installation_id uuid;
alter table public.users add column digest_ticket_id text;
alter table public.users add column digest_submitted_at timestamptz;
alter table public.users add column digest_delivery_state text check(digest_delivery_state in ('claimed','accepted','failed','unknown','delivered','receipt_error'));

update public.users u set first_saved_at=(select min(created_at) from public.saved_items where user_id=u.id);
create function public.retain_first_save() returns trigger language plpgsql security definer set search_path='' as $$ begin
 update public.users set first_saved_at=least(first_saved_at,new.created_at) where id=new.user_id;
 return new;
end; $$;
create trigger retain_first_save after insert on public.saved_items for each row execute function public.retain_first_save();
revoke all on function public.retain_first_save() from public,anon,authenticated;
create function public.retain_reminder_success() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.action in ('navigate','been_there') and new.action_at is not null then
  update public.users u set first_reminder_success_at=least(u.first_reminder_success_at,new.action_at)
  from public.places p join public.saved_items s on s.id=p.saved_item_id
  where p.id=new.place_id and u.id=s.user_id and new.action_at>=u.first_saved_at and new.action_at<u.first_saved_at+interval '7 days';
 end if;
 return new;
end; $$;
create trigger retain_reminder_success after insert or update of action,action_at on public.reminders for each row execute function public.retain_reminder_success();
revoke all on function public.retain_reminder_success() from public,anon,authenticated;
update public.users u set first_reminder_success_at=(select min(r.action_at) from public.reminders r join public.places p on p.id=r.place_id join public.saved_items s on s.id=p.saved_item_id where s.user_id=u.id and r.action in ('navigate','been_there') and r.action_at>=u.first_saved_at and r.action_at<u.first_saved_at+interval '7 days');

create function public.success_metric(p_as_of timestamptz default now(),p_cohort_start timestamptz default null,p_cohort_end timestamptz default null)
returns table(eligible_users bigint,successful_users bigint,success_rate numeric,target_met boolean) language sql stable security definer set search_path='' as $$
 with totals as (select count(*) as eligible,count(*) filter(where first_reminder_success_at>=first_saved_at and first_reminder_success_at<first_saved_at+interval '7 days' and first_reminder_success_at<p_as_of) as successful from public.users where not deletion_requested and first_saved_at<=p_as_of-interval '7 days' and (p_cohort_start is null or first_saved_at>=p_cohort_start) and (p_cohort_end is null or first_saved_at<p_cohort_end))
 select eligible,successful,successful::numeric/nullif(eligible,0),eligible>0 and successful::numeric/nullif(eligible,0)>=0.15 from totals;
$$;
revoke all on function public.success_metric(timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.success_metric(timestamptz,timestamptz,timestamptz) to service_role;

create function public.set_analytics_consent(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_enabled is null then raise exception 'invalid_consent'; end if;
 update public.users set analytics_opt_in=p_enabled where id=auth.uid() and not deletion_requested;
 if not found then raise exception 'account_unavailable' using errcode='42501'; end if;
end; $$;
revoke all on function public.set_analytics_consent(boolean) from public,anon;
grant execute on function public.set_analytics_consent(boolean) to authenticated;
create function public.consume_analytics_quota(p_user_id uuid,p_events integer) returns text language plpgsql security definer set search_path='' as $$ declare u public.users; begin
 select * into u from public.users where id=p_user_id for update;
 if not found or u.deletion_requested or not u.analytics_opt_in then return 'disabled'; end if;
 if p_events is null or p_events not between 1 and 20 then return 'limited'; end if;
 if u.analytics_window_start<=now()-interval '1 hour' then update public.users set analytics_window_start=now(),analytics_attempts=0 where id=p_user_id;u.analytics_attempts:=0;end if;
 if u.analytics_attempts+p_events>1000 then return 'limited';end if;
 update public.users set analytics_attempts=analytics_attempts+p_events where id=p_user_id;return 'allowed';
end; $$;
revoke all on function public.consume_analytics_quota(uuid,integer) from public,anon,authenticated;
grant execute on function public.consume_analytics_quota(uuid,integer) to service_role;

create function public.set_digest_preferences(p_enabled boolean,p_installation_id uuid,p_token text,p_timezone text) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_enabled is null or p_installation_id is null then raise exception 'invalid_preferences';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'invalid_timezone';end if;
 if p_enabled and (p_token is null or length(p_token)>200 or p_token!~'^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$') then raise exception 'invalid_token';end if;
 -- At most one active device per user; the latest explicit enable owns the token.
 update public.users set digest_enabled=p_enabled,push_token=case when p_enabled then p_token else null end,push_installation_id=case when p_enabled then p_installation_id else null end,digest_timezone=p_timezone,digest_nearby_ids='{}',digest_nearby_until=null where id=auth.uid() and not deletion_requested and (p_enabled or push_installation_id=p_installation_id or push_installation_id is null);
 if not found and p_enabled then raise exception 'account_unavailable' using errcode='42501';end if;
end; $$;
revoke all on function public.set_digest_preferences(boolean,uuid,text,text) from public,anon;
grant execute on function public.set_digest_preferences(boolean,uuid,text,text) to authenticated;
-- Foreground refresh is a compare-and-set, never an implicit device takeover.
create function public.refresh_digest_token(p_installation_id uuid,p_token text,p_timezone text) returns boolean language plpgsql security definer set search_path='' as $$ begin
 if p_token is null or length(p_token)>200 or p_token!~'^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'invalid_preferences';end if;
 update public.users set push_token=p_token,digest_timezone=p_timezone where id=auth.uid() and not deletion_requested and digest_enabled and push_installation_id=p_installation_id;
 return found;
end; $$;
revoke all on function public.refresh_digest_token(uuid,text,text) from public,anon;
grant execute on function public.refresh_digest_token(uuid,text,text) to authenticated;
create function public.publish_digest_nearby(p_installation_id uuid,p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_ids is null or cardinality(p_ids)>100 then raise exception 'invalid_selection';end if;
 if exists(select 1 from unnest(p_ids) selected(id) where not exists(select 1 from public.places p join public.saved_items s on s.id=p.saved_item_id where p.id=selected.id and s.user_id=auth.uid() and s.status='confirmed' and p.coordinates_expire_at>now() and p.lat is not null)) then raise exception 'selection_unavailable' using errcode='42501';end if;
 update public.users set digest_nearby_ids=p_ids,digest_nearby_until=now()+interval '6 hours' where id=auth.uid() and not deletion_requested and digest_enabled and push_installation_id=p_installation_id;
end; $$;
revoke all on function public.publish_digest_nearby(uuid,uuid[]) from public,anon;
grant execute on function public.publish_digest_nearby(uuid,uuid[]) to authenticated;

create function public.claim_weekly_digest(p_now timestamptz default now(),p_limit integer default 100)
returns table(user_id uuid,token text,lease_id uuid,place_count integer) language plpgsql security definer set search_path='' as $$ declare u public.users;n integer;week date;lease uuid;begin
 for u in select * from public.users where digest_enabled and not deletion_requested and push_token is not null and digest_nearby_until>p_now and extract(isodow from p_now at time zone digest_timezone)=5 and extract(hour from p_now at time zone digest_timezone)=18 and digest_last_week is distinct from date_trunc('week',p_now at time zone digest_timezone)::date order by id limit least(greatest(coalesce(p_limit,100),1),100) for update skip locked loop
  select count(*)::integer into n from public.places p join public.saved_items s on s.id=p.saved_item_id where s.user_id=u.id and s.status='confirmed' and p.id=any(u.digest_nearby_ids) and p.coordinates_expire_at>p_now and p.lat is not null;
  if n=0 then continue;end if;
  week:=date_trunc('week',p_now at time zone u.digest_timezone)::date;lease:=gen_random_uuid();
  -- Reserve before the external call: at-most-once send attempts, including ambiguous failures.
  update public.users set digest_last_week=week,digest_lease_id=lease,digest_target_token=u.push_token,digest_target_installation_id=u.push_installation_id,digest_ticket_id=null,digest_submitted_at=p_now,digest_delivery_state='claimed' where id=u.id;
  user_id:=u.id;token:=u.push_token;lease_id:=lease;place_count:=n;return next;
 end loop;
end; $$;
revoke all on function public.claim_weekly_digest(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.claim_weekly_digest(timestamptz,integer) to service_role;
create function public.digest_still_allowed(p_user_id uuid,p_lease_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.users u where u.id=p_user_id and u.digest_lease_id=p_lease_id and u.digest_enabled and not u.deletion_requested and u.push_token=u.digest_target_token and u.push_installation_id=u.digest_target_installation_id and u.digest_nearby_until>now() and exists(select 1 from public.places p join public.saved_items s on s.id=p.saved_item_id where s.user_id=u.id and s.status='confirmed' and p.id=any(u.digest_nearby_ids) and p.coordinates_expire_at>now() and p.lat is not null)); $$;
revoke all on function public.digest_still_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.digest_still_allowed(uuid,uuid) to service_role;
create function public.finish_digest(p_user_id uuid,p_lease_id uuid,p_state text,p_ticket_id text,p_invalid_token boolean) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_state not in ('accepted','failed','unknown','delivered','receipt_error') or length(p_ticket_id)>200 then raise exception 'invalid_result';end if;
 update public.users set digest_delivery_state=p_state,digest_ticket_id=case when p_state='accepted' then p_ticket_id else null end,push_token=case when p_invalid_token and push_token=digest_target_token and push_installation_id=digest_target_installation_id then null else push_token end,digest_enabled=case when p_invalid_token and push_token=digest_target_token and push_installation_id=digest_target_installation_id then false else digest_enabled end where id=p_user_id and digest_lease_id=p_lease_id;
end; $$;
revoke all on function public.finish_digest(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_digest(uuid,uuid,text,text,boolean) to service_role;
create function public.pending_digest_receipts(p_now timestamptz default now()) returns table(user_id uuid,lease_id uuid,ticket_id text,expired boolean) language sql stable security definer set search_path='' as $$ select id,digest_lease_id,digest_ticket_id,digest_submitted_at<p_now-interval '24 hours' from public.users where digest_ticket_id is not null and digest_delivery_state='accepted' and digest_submitted_at<p_now-interval '15 minutes' order by digest_submitted_at limit 100; $$;
revoke all on function public.pending_digest_receipts(timestamptz) from public,anon,authenticated;
grant execute on function public.pending_digest_receipts(timestamptz) to service_role;

create function public.clear_expired_digest_nearby() returns void language sql security definer set search_path='' as $$ update public.users set digest_nearby_ids='{}',digest_nearby_until=null where digest_nearby_until<=now(); $$;
revoke all on function public.clear_expired_digest_nearby() from public,anon,authenticated;
grant execute on function public.clear_expired_digest_nearby() to service_role;
do $$ begin if exists(select 1 from pg_available_extensions where name='pg_cron') then perform cron.schedule('clear-expired-digest-nearby','*/10 * * * *','select public.clear_expired_digest_nearby()');end if;end; $$;
