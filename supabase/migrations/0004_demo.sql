-- Simulated demo organisation: load and reset. Service role only (called by the demo-seed function or scripts/seed-demo.mjs).
create function public.demo_reset(p_org uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.organizations where id = p_org and is_demo) then raise exception 'not a demo organisation'; end if;
  delete from public.alerts where org_id = p_org; delete from public.insights where org_id = p_org; delete from public.segment_exposure where org_id = p_org;
  delete from public.audit_log where org_id = p_org;
  delete from public.checkpoints where org_id = p_org; delete from public.lots where org_id = p_org;
  delete from public.farmers where org_id = p_org; delete from public.transporters where org_id = p_org; delete from public.centres where org_id = p_org; delete from public.crops where org_id = p_org;
end $$;

-- p_data holds the generated scenario; columns are listed explicitly so a missing key can never become an accidental NULL default.
create function public.demo_load(p_data jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
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
  return jsonb_build_object('lots', (select count(*) from public.lots where org_id = org), 'checkpoints', (select count(*) from public.checkpoints where org_id = org));
end $$;
revoke all on function public.demo_reset(uuid), public.demo_load(jsonb) from public, anon, authenticated;
grant execute on function public.demo_reset(uuid), public.demo_load(jsonb) to service_role;
