alter table public.users add column diagnostics_opt_in boolean not null default false;
create function public.set_diagnostics_consent(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_enabled is null then raise exception 'invalid_consent';end if;
 update public.users set diagnostics_opt_in=p_enabled where id=auth.uid() and not deletion_requested;
 if not found then raise exception 'account_unavailable' using errcode='42501';end if;
end; $$;
revoke all on function public.set_diagnostics_consent(boolean) from public,anon;
grant execute on function public.set_diagnostics_consent(boolean) to authenticated;
create function public.consume_diagnostics_quota(p_user_id uuid) returns text language plpgsql security definer set search_path='' as $$ declare u public.users;begin
 select * into u from public.users where id=p_user_id for update;
 if not found or u.deletion_requested or not u.diagnostics_opt_in then return 'disabled';end if;
 if u.analytics_window_start<=now()-interval '1 hour' then update public.users set analytics_window_start=now(),analytics_attempts=0 where id=p_user_id;u.analytics_attempts:=0;end if;
 if u.analytics_attempts>=1000 then return 'limited';end if;
 update public.users set analytics_attempts=analytics_attempts+1 where id=p_user_id;return 'allowed';
end; $$;
revoke all on function public.consume_diagnostics_quota(uuid) from public,anon,authenticated;
grant execute on function public.consume_diagnostics_quota(uuid) to service_role;
