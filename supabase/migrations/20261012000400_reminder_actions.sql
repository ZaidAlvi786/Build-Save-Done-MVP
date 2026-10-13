-- First explicit interaction wins, preserving the metric across retries/devices.
revoke insert,update on public.reminders from authenticated;
revoke insert(id,place_id,sent_at,action,action_at),update(action,action_at) on public.reminders from authenticated;
create function public.record_reminder(p_id uuid,p_place_id uuid,p_sent_at timestamptz,p_action text,p_action_at timestamptz)
returns text language plpgsql security definer set search_path='' as $$
declare existing public.reminders; result text;
begin
 if not exists(select 1 from public.users where id=auth.uid() and not deletion_requested) then raise exception 'account_unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.places p join public.saved_items s on s.id=p.saved_item_id where p.id=p_place_id and s.user_id=auth.uid() and s.status in ('confirmed','visited')) then raise exception 'place_unavailable' using errcode='42501'; end if;
 if p_sent_at is null or p_sent_at>now()+interval '5 minutes' or p_action is null or p_action not in ('ignored','navigate','snooze','been_there') or (p_action='ignored')<>(p_action_at is null) or p_action_at<p_sent_at or p_action_at>now()+interval '5 minutes' then raise exception 'invalid_reminder'; end if;
 insert into public.reminders(id,place_id,sent_at,action,action_at) values(p_id,p_place_id,p_sent_at,p_action,p_action_at) on conflict(id) do nothing;
 select * into existing from public.reminders where id=p_id for update;
 if existing.place_id<>p_place_id or existing.sent_at<>p_sent_at then raise exception 'reminder_mismatch' using errcode='42501'; end if;
 if existing.action='ignored' and p_action<>'ignored' then update public.reminders set action=p_action,action_at=p_action_at where id=p_id; existing.action:=p_action; end if;
 if existing.action='been_there' then update public.saved_items set status='visited' where id=(select saved_item_id from public.places where id=p_place_id); end if;
 result:=existing.action; return result;
end; $$;
revoke all on function public.record_reminder(uuid,uuid,timestamptz,text,timestamptz) from public,anon;
grant execute on function public.record_reminder(uuid,uuid,timestamptz,text,timestamptz) to authenticated;

-- Provider coordinate refresh remains privileged and ownership checked.
create function public.refresh_place_coordinates(p_user_id uuid,p_place_id uuid,p_lat double precision,p_lng double precision) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_lat is null or p_lng is null then return false; end if;
 update public.places set lat=p_lat,lng=p_lng,coordinates_expire_at=now()+interval '29 days' where id=p_place_id and exists(select 1 from public.saved_items s join public.users u on u.id=s.user_id where s.id=saved_item_id and s.user_id=p_user_id and not u.deletion_requested and s.status in ('confirmed','visited'));
 return found;
end; $$;
revoke all on function public.refresh_place_coordinates(uuid,uuid,double precision,double precision) from public,anon,authenticated;
grant execute on function public.refresh_place_coordinates(uuid,uuid,double precision,double precision) to service_role;
