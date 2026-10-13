-- Service-only transactions implement durable per-user throttling and fenced leases.
create function public.claim_extraction(p_user_id uuid,p_item_id uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.users; s public.saved_items;
begin
  -- Always lock in this order, serializing per-user quotas across Edge instances.
  select * into u from public.users where id=p_user_id for update;
  if not found then return jsonb_build_object('state','not_found'); end if;
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
create function public.finish_extraction(p_user_id uuid,p_item_id uuid,p_token uuid,p_result jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.saved_items set raw_ai_json=p_result,extraction_token=null,extraction_lease_until=null
  where id=p_item_id and user_id=p_user_id and extraction_token=p_token and extraction_lease_until>now() and status='pending';
  return found;
end; $$;
create function public.release_extraction(p_user_id uuid,p_item_id uuid,p_token uuid)
returns void language sql security definer set search_path='' as $$
  update public.saved_items set extraction_token=null,extraction_lease_until=null
  where id=p_item_id and user_id=p_user_id and extraction_token=p_token;
$$;
revoke all on function public.claim_extraction(uuid,uuid,uuid),public.finish_extraction(uuid,uuid,uuid,jsonb),public.release_extraction(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_extraction(uuid,uuid,uuid),public.finish_extraction(uuid,uuid,uuid,jsonb),public.release_extraction(uuid,uuid,uuid) to service_role;
