-- Gives the demo organisation's canonical example lot (T-1043, used throughout the docs and screenshots) a fixed,
-- well-known public_token instead of the random one every other lot gets, so the login page can link straight to
-- a working "sample farmer report" without any extra lookup. Harmless: it is still just the demo org's simulated data.
create or replace function public.demo_load(p_data jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare org uuid := (p_data -> 'organization' ->> 'id')::uuid;
begin
  if not coalesce((p_data -> 'organization' ->> 'is_demo')::boolean, false) then raise exception 'only the demo organisation can be loaded'; end if;
  perform set_config('lossmap.seeding', 'on', true);
  insert into public.organizations (id, name, type, is_demo) values (org, p_data -> 'organization' ->> 'name', p_data -> 'organization' ->> 'type', true)
    on conflict (id) do update set name = excluded.name, is_demo = true;
  perform public.demo_reset(org);
  insert into public.crops (id, org_id, name, name_te, code_prefix, price_per_kg, damaged_value_factor, heat_threshold_c, max_safe_wait_hours, unit_tolerance_pct)
    select id, org_id, name, name_te, code_prefix, price_per_kg, damaged_value_factor, heat_threshold_c, max_safe_wait_hours, unit_tolerance_pct from jsonb_populate_recordset(null::public.crops, p_data -> 'crops');
  insert into public.centres (id, org_id, name, type, lat, lng, radius_m, expected_transport_h)
    select id, org_id, name, type, lat, lng, radius_m, expected_transport_h from jsonb_populate_recordset(null::public.centres, p_data -> 'centres');
  insert into public.transporters (id, org_id, name, vehicle_no)
    select id, org_id, name, vehicle_no from jsonb_populate_recordset(null::public.transporters, p_data -> 'transporters');
  insert into public.farmers (id, org_id, name, village)
    select id, org_id, name, village from jsonb_populate_recordset(null::public.farmers, p_data -> 'farmers');
  insert into public.lots (id, org_id, short_code, qr_code, farmer_id, crop_id, crate_count, status, created_by, created_at)
    select id, org_id, short_code, qr_code, farmer_id, crop_id, crate_count, status, created_by, created_at from jsonb_populate_recordset(null::public.lots, p_data -> 'lots');
  insert into public.checkpoints (id, org_id, lot_id, stage, centre_id, transporter_id, weight_kg, weight_source, crate_count, quality_good_pct, quality_damaged_pct, quality_rotten_pct, capture_method, lat, lng, device_captured_at, recorded_by, flags)
    select id, org_id, lot_id, stage, centre_id, transporter_id, weight_kg, 'manual', crate_count, quality_good_pct, quality_damaged_pct, quality_rotten_pct, 'camera', lat, lng, device_captured_at, null, '{}'
    from jsonb_populate_recordset(null::public.checkpoints, p_data -> 'checkpoints');
  update public.lots set public_token = '7f3a9c2e1b6d4850a2f9e7c3b1d6485029f3e7c1b9d6485a2f9e7c3b1d64850'
    where org_id = org and short_code = 'T-1043';
  return jsonb_build_object('lots', (select count(*) from public.lots where org_id = org), 'checkpoints', (select count(*) from public.checkpoints where org_id = org));
end $$;
