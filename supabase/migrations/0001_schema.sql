-- LossMap core schema. Multi-tenant: every table carries org_id and is protected by row-level security.
-- Composite (id, org_id) foreign keys make cross-organisation references impossible.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'processor' check (type in ('processor', 'fpo', 'aggregator', 'exporter')),
  is_demo boolean not null default false,
  telegram_chat_id bigint,
  telegram_link_token text unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  role text not null check (role in ('manager', 'field_agent', 'factory_receiver')),
  name text not null,
  phone text,
  email text,
  language text not null default 'en' check (language in ('en', 'te')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);
create index profiles_org_idx on public.profiles (org_id);

-- SECURITY DEFINER so policies on profiles itself cannot recurse. A disabled person resolves to nothing: access ends at once.
create function public.auth_org() returns uuid language sql stable security definer set search_path = public as
$$ select org_id from public.profiles where user_id = auth.uid() and not disabled $$;
create function public.auth_role() returns text language sql stable security definer set search_path = public as
$$ select role from public.profiles where user_id = auth.uid() and not disabled $$;
create function public.can_see_analytics() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(public.auth_role() = 'manager', false) $$;

create table public.farmers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null, village text not null,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create table public.crops (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null, name_te text,
  code_prefix text not null default 'X' check (char_length(code_prefix) = 1),
  price_per_kg numeric(8, 2) not null check (price_per_kg >= 0),
  damaged_value_factor numeric(3, 2) not null default 0.5 check (damaged_value_factor between 0 and 1),
  heat_threshold_c numeric(4, 1) not null default 30,
  max_safe_wait_hours numeric(4, 1) not null default 3,
  unit_tolerance_pct numeric(4, 2) not null default 1,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create table public.centres (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  type text not null check (type in ('collection_centre', 'factory', 'storage')),
  lat double precision not null, lng double precision not null,
  radius_m integer not null default 300 check (radius_m > 0),
  expected_transport_h numeric(5, 2),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create table public.transporters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null, vehicle_no text,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create table public.lots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  short_code text not null, qr_code text not null,
  farmer_id uuid not null, crop_id uuid not null,
  crate_count integer check (crate_count is null or crate_count >= 1),
  status text not null default 'open' check (status in ('open', 'delivered')),
  public_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (id, org_id), unique (org_id, short_code),
  foreign key (farmer_id, org_id) references public.farmers (id, org_id),
  foreign key (crop_id, org_id) references public.crops (id, org_id)
);

create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  lot_id uuid not null,
  stage text not null check (stage in ('farm_pickup', 'centre_arrival', 'centre_dispatch', 'storage_in', 'storage_out', 'factory_arrival')),
  centre_id uuid, transporter_id uuid,
  weight_kg numeric(9, 2) not null check (weight_kg > 0),
  weight_source text not null default 'manual' check (weight_source in ('manual', 'ai', 'ai_edited')),
  ai_weight_kg numeric(9, 2), ai_confidence numeric(4, 3),
  crate_count integer check (crate_count is null or crate_count >= 1),
  quality_good_pct numeric(5, 2), quality_damaged_pct numeric(5, 2), quality_rotten_pct numeric(5, 2),
  quality_is_ai boolean not null default false, quality_confidence numeric(4, 3),
  scale_photo_url text, produce_photo_url text, photo_hash text,
  capture_method text not null default 'camera' check (capture_method in ('camera', 'file_input')),
  lat double precision, lng double precision, gps_accuracy_m double precision,
  device_captured_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  flags text[] not null default '{}',
  offline_synced boolean not null default false,
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (lot_id, org_id) references public.lots (id, org_id) on delete cascade,
  foreign key (centre_id, org_id) references public.centres (id, org_id),
  foreign key (transporter_id, org_id) references public.transporters (id, org_id),
  check ((quality_good_pct is null) = (quality_damaged_pct is null) and (quality_good_pct is null) = (quality_rotten_pct is null)),
  check (quality_good_pct is null or abs(quality_good_pct + quality_damaged_pct + quality_rotten_pct - 100) <= 0.5),
  -- photos live in the organisation's own folder
  check (scale_photo_url is null or scale_photo_url like org_id::text || '/%'),
  check (produce_photo_url is null or produce_photo_url like org_id::text || '/%')
);
create index checkpoints_lot_idx on public.checkpoints (lot_id, device_captured_at);
create index checkpoints_org_idx on public.checkpoints (org_id, device_captured_at);

create table public.segment_exposure (
  to_checkpoint_id uuid primary key references public.checkpoints (id) on delete cascade,
  from_checkpoint_id uuid not null references public.checkpoints (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  status text not null check (status in ('ok', 'unavailable')),
  heat_hours numeric(5, 2), avg_temp_c numeric(4, 1), max_temp_c numeric(4, 1),
  computed_at timestamptz not null default now()
);
create table public.weather_cache (
  cell text not null, day date not null, temps_c numeric[] not null, humidity numeric[],
  fetched_at timestamptz not null default now(), primary key (cell, day)
);
create table public.ai_cache (photo_hash text not null, task text not null, result jsonb not null, created_at timestamptz not null default now(), primary key (photo_hash, task));
create table public.ai_usage (day date not null, task text not null, count integer not null default 0, primary key (day, task));

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  lot_id uuid not null, severity text not null check (severity in ('warn', 'critical')),
  rule text not null, dedupe_key text not null,
  message_en text not null, message_te text,
  notified_at timestamptz, acknowledged_by uuid references auth.users (id), acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, dedupe_key),
  foreign key (lot_id, org_id) references public.lots (id, org_id) on delete cascade
);
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  week_start date not null, text_en text not null, text_te text, recommendation text,
  numbers jsonb not null, created_at timestamptz not null default now(),
  unique (org_id, week_start)
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null, table_name text not null, row_id uuid not null, field text not null,
  old_value text, new_value text, changed_by uuid, changed_at timestamptz not null default now()
);
create index audit_row_idx on public.audit_log (row_id);

-- ---------------------------------------------------------------- server-side integrity
create function public.stage_rank(s text) returns int language sql immutable as
$$ select array_position(array['farm_pickup','centre_arrival','centre_dispatch','storage_in','storage_out','factory_arrival'], s) $$;

create function public.haversine_m(a_lat float8, a_lng float8, b_lat float8, b_lng float8) returns float8 language sql immutable as
$$ select 2 * 6371000 * asin(sqrt(power(sin(radians(b_lat - a_lat) / 2), 2) + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))) $$;

create function public.checkpoint_before_write() returns trigger language plpgsql security definer set search_path = public as
$$
declare c record; f text[] := '{}';
begin
  -- the simulated demo is loaded by demo_load(), which keeps its generated flags and weight sources
  if current_setting('lossmap.seeding', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.server_received_at := now();
    new.recorded_by := coalesce(auth.uid(), new.recorded_by);
    if new.lat is null or new.lng is null then f := f || 'no_gps'::text;
    elsif new.centre_id is not null then
      select * into c from public.centres where id = new.centre_id;
      if c.id is not null and public.haversine_m(new.lat, new.lng, c.lat, c.lng) > c.radius_m then f := f || 'gps_far'::text; end if;
    end if;
    if new.capture_method = 'file_input' then f := f || 'file_input'::text; end if;
    if new.device_captured_at > now() + interval '5 minutes' then f := f || 'clock_ahead'::text; end if;
    if new.device_captured_at < now() - interval '72 hours' then f := f || 'late_sync'::text; end if;
    if new.ai_weight_kg is not null and new.weight_kg <> new.ai_weight_kg then new.weight_source := 'ai_edited'; f := f || 'weight_edited'::text;
    elsif new.ai_weight_kg is not null then new.weight_source := 'ai'; else new.weight_source := 'manual'; end if;
    new.flags := f;
  else
    -- evidence is immutable; only the weight (audited) may change
    if new.scale_photo_url is distinct from old.scale_photo_url or new.produce_photo_url is distinct from old.produce_photo_url
       or new.photo_hash is distinct from old.photo_hash or new.device_captured_at <> old.device_captured_at
       or new.lot_id <> old.lot_id or new.stage <> old.stage or new.org_id <> old.org_id or new.ai_weight_kg is distinct from old.ai_weight_kg then
      raise exception 'checkpoint evidence is immutable';
    end if;
    if new.weight_kg <> old.weight_kg then
      insert into public.audit_log (org_id, table_name, row_id, field, old_value, new_value, changed_by)
      values (old.org_id, 'checkpoints', old.id, 'weight_kg', old.weight_kg::text, new.weight_kg::text, auth.uid());
      new.weight_source := 'ai_edited'; new.flags := array(select distinct unnest(old.flags || 'weight_edited'::text));
    end if;
  end if;
  return new;
end
$$;
create trigger checkpoint_write before insert or update on public.checkpoints for each row execute function public.checkpoint_before_write();

create function public.alert_guard() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  if new.acknowledged_at is not null and old.acknowledged_at is null then new.acknowledged_by := auth.uid(); new.acknowledged_at := now(); end if;
  if (new.message_en, new.rule, new.severity, new.lot_id, new.dedupe_key, new.org_id) is distinct from (old.message_en, old.rule, old.severity, old.lot_id, old.dedupe_key, old.org_id) then
    raise exception 'only acknowledgement can change'; end if;
  return new;
end $$;
create trigger alert_write before update on public.alerts for each row execute function public.alert_guard();

-- ---------------------------------------------------------------- row-level security
grant usage on schema public to anon, authenticated, service_role;
grant select on public.organizations to authenticated; -- narrowed below
revoke select on public.organizations from authenticated;
grant select (id, name, type, is_demo, created_at) on public.organizations to authenticated;
grant update (name, type) on public.organizations to authenticated;
grant select on public.profiles, public.farmers, public.centres, public.crops, public.transporters, public.lots, public.checkpoints,
  public.segment_exposure, public.alerts, public.insights, public.audit_log to authenticated;
grant insert, update on public.farmers, public.centres, public.crops, public.transporters to authenticated;
grant delete on public.centres, public.crops, public.transporters to authenticated;
grant insert on public.lots to authenticated;
grant update (status) on public.lots to authenticated;
grant insert, update on public.checkpoints to authenticated;
grant update (name, phone, language) on public.profiles to authenticated;
grant update (acknowledged_by, acknowledged_at) on public.alerts to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

do $$ declare t text; begin
  foreach t in array array['organizations','profiles','farmers','crops','centres','transporters','lots','checkpoints','segment_exposure','weather_cache','ai_cache','ai_usage','alerts','insights','audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy org_read on public.organizations for select to authenticated using (id = public.auth_org());
create policy org_update on public.organizations for update to authenticated
  using (id = public.auth_org() and public.auth_role() = 'manager') with check (id = public.auth_org());
create policy profiles_read on public.profiles for select to authenticated using (org_id = public.auth_org());
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and org_id = public.auth_org());

create policy farmers_read on public.farmers for select to authenticated using (org_id = public.auth_org());
create policy farmers_insert on public.farmers for insert to authenticated with check (org_id = public.auth_org());
create policy farmers_update on public.farmers for update to authenticated
  using (org_id = public.auth_org() and public.auth_role() = 'manager') with check (org_id = public.auth_org());
do $$ declare t text; begin
  foreach t in array array['centres','crops','transporters'] loop
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using (org_id = public.auth_org())', t);
    execute format('create policy %1$s_write on public.%1$I for all to authenticated using (org_id = public.auth_org() and public.auth_role() = ''manager'') with check (org_id = public.auth_org() and public.auth_role() = ''manager'')', t);
  end loop;
end $$;

create policy lots_read on public.lots for select to authenticated using (org_id = public.auth_org());
create policy lots_insert on public.lots for insert to authenticated with check (org_id = public.auth_org());
create policy lots_update on public.lots for update to authenticated using (org_id = public.auth_org()) with check (org_id = public.auth_org());
create policy cp_read on public.checkpoints for select to authenticated using (org_id = public.auth_org());
create policy cp_insert on public.checkpoints for insert to authenticated with check (org_id = public.auth_org());
-- only managers correct recorded data
create policy cp_update on public.checkpoints for update to authenticated
  using (org_id = public.auth_org() and public.auth_role() = 'manager') with check (org_id = public.auth_org());
create policy exposure_read on public.segment_exposure for select to authenticated using (org_id = public.auth_org());
create policy alerts_read on public.alerts for select to authenticated using (org_id = public.auth_org() and public.can_see_analytics());
create policy alerts_ack on public.alerts for update to authenticated
  using (org_id = public.auth_org() and public.can_see_analytics()) with check (org_id = public.auth_org());
create policy insights_read on public.insights for select to authenticated using (org_id = public.auth_org() and public.can_see_analytics());
create policy audit_read on public.audit_log for select to authenticated using (org_id = public.auth_org());
-- weather_cache, ai_cache, ai_usage: no policy = server only (service role)
