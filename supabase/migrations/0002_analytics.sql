-- Loss views and analytics. The view decides the cause rule; TypeScript only formats text.
-- Everything is security_invoker, so row-level security applies to the caller; only managers see any rows.

create view public.lot_segments with (security_invoker = true) as
with q as (
  select c.*, l.short_code as lot_code, cr.price_per_kg, cr.damaged_value_factor, cr.heat_threshold_c, cr.max_safe_wait_hours, cr.unit_tolerance_pct,
         case when c.quality_good_pct is null then null else (c.quality_good_pct + cr.damaged_value_factor * c.quality_damaged_pct) / 100 end as qf
  from public.checkpoints c
  join public.lots l on l.id = c.lot_id and l.org_id = c.org_id
  join public.crops cr on cr.id = l.crop_id and cr.org_id = l.org_id
), p as (
  select q.*,
    lag(id) over w as p_id, lag(stage) over w as p_stage, lag(weight_kg) over w as p_w, lag(device_captured_at) over w as p_at,
    lag(centre_id) over w as p_centre, lag(quality_good_pct) over w as p_good,
    -- quality carries over from the last assessed checkpoint when a worker did not assess it
    coalesce(lag(qf) over w, 1) as p_qf_raw,
    row_number() over w as seq
  from q window w as (partition by lot_id order by device_captured_at, public.stage_rank(stage))
), s as (
  select p.*, coalesce(p_qf_raw, 1) as qp, coalesce(qf, p_qf_raw, 1) as qc,
    (qf is not null and p_good is not null) as quality_assessed
  from p where p_id is not null
), k as (
  select s.*,
    case when p_stage = 'farm_pickup' and stage = 'centre_arrival' then 'handling_in'
         when p_stage = 'centre_arrival' and stage = 'centre_dispatch' then 'waiting'
         when p_stage = 'storage_in' and stage = 'storage_out' then 'storage'
         when p_stage in ('centre_dispatch', 'storage_out') and stage = 'factory_arrival' then 'transport'
         else 'other' end as kind,
    round(extract(epoch from (device_captured_at - p_at)) / 3600.0, 2) as dur_h,
    greatest(0, p_w - weight_kg) as w_loss
  from s
), m as (
  select k.*, round(w_loss * price_per_kg * qp, 2) as w_rs,
    round(greatest(0, qp - qc) * weight_kg * price_per_kg, 2) as q_rs,
    round(p_w * price_per_kg * qp, 2) as v_from
  from k
)
select m.org_id, m.lot_id, m.lot_code, (m.seq - 2)::int as seg_index, m.p_id as from_checkpoint_id, m.id as to_checkpoint_id,
  m.p_stage as from_stage, m.stage as to_stage, m.kind,
  case m.kind when 'waiting' then m.centre_id when 'handling_in' then m.centre_id else coalesce(m.p_centre, m.centre_id) end as centre_id,
  m.transporter_id, m.p_at as started_at, m.device_captured_at as ended_at, m.dur_h as duration_h,
  m.p_w as weight_from_kg, m.weight_kg as weight_to_kg, round(m.qp, 4) as q_from, round(m.qc, 4) as q_to,
  m.w_loss as weight_loss_kg, m.w_rs as weight_loss_rs, m.q_rs as quality_loss_rs, m.w_rs + m.q_rs as total_loss_rs,
  m.v_from as value_from,
  case when m.v_from > 0 then round((m.w_rs + m.q_rs) / m.v_from * 100, 2) else 0 end as loss_pct,
  (m.weight_kg > m.p_w) as measurement_variance, m.quality_assessed,
  x.heat_hours, x.avg_temp_c, x.max_temp_c, x.status as exposure_status,
  m.max_safe_wait_hours, ce.expected_transport_h, greatest(0, m.p_good - m.quality_good_pct) as quality_drop_points,
  case
    when m.p_w > 0 and abs(m.p_w - m.weight_kg) / m.p_w * 100 <= m.unit_tolerance_pct and m.q_rs = 0 then 'within_tolerance'
    when m.kind = 'waiting' and m.dur_h > m.max_safe_wait_hours and coalesce(x.heat_hours, 0) >= 1 then 'R1_heat_during_waiting'
    when m.kind = 'waiting' and m.dur_h > m.max_safe_wait_hours then 'R2_waited_too_long'
    when m.kind = 'transport' and ce.expected_transport_h is not null and m.dur_h > ce.expected_transport_h * 1.25 then 'R3_transport_delay'
    when m.kind = 'handling_in' and coalesce(m.p_good - m.quality_good_pct, 0) >= 5 then 'R4_handling_damage'
    when m.w_rs + m.q_rs > 0 then 'unexplained'
    else 'within_tolerance' end as cause_rule,
  m.flags
from m
left join public.segment_exposure x on x.to_checkpoint_id = m.id and x.from_checkpoint_id = m.p_id
left join public.centres ce on ce.id = m.p_centre
where (select public.can_see_analytics());

-- Value of each lot at the farm gate, counted once per lot: the base for whole-lot percentages.
create view public.lot_start_value with (security_invoker = true) as
select distinct on (c.lot_id) c.org_id, c.lot_id,
  round(c.weight_kg * cr.price_per_kg * coalesce((c.quality_good_pct + cr.damaged_value_factor * c.quality_damaged_pct) / 100, 1), 2) as value_rs
from public.checkpoints c
join public.lots l on l.id = c.lot_id and l.org_id = c.org_id
join public.crops cr on cr.id = l.crop_id and cr.org_id = l.org_id
where (select public.can_see_analytics())
order by c.lot_id, c.device_captured_at, public.stage_rank(c.stage);

create view public.waiting_lots with (security_invoker = true) as
select l.org_id, l.id as lot_id, l.short_code as lot_code, a.centre_id, a.at as arrived_at, cr.max_safe_wait_hours, cr.heat_threshold_c, cr.id as crop_id
from public.lots l
join public.crops cr on cr.id = l.crop_id and cr.org_id = l.org_id
cross join lateral (
  select count(*) filter (where stage = 'centre_arrival') as arrivals, count(*) filter (where stage = 'centre_dispatch') as dispatches,
         count(*) filter (where stage = 'storage_in') as s_in, count(*) filter (where stage = 'storage_out') as s_out,
         count(*) filter (where stage = 'factory_arrival') as delivered
  from public.checkpoints where lot_id = l.id) n
join lateral (select centre_id, device_captured_at as at from public.checkpoints where lot_id = l.id and stage = 'centre_arrival' order by device_captured_at desc limit 1) a on true
where n.arrivals > n.dispatches and n.s_in <= n.s_out and n.delivered = 0 and (select public.can_see_analytics());

-- ---------------------------------------------------------------- analytics functions (p_org: used by scheduled jobs running as service role)
create function public.dashboard_kpis(p_org uuid default null, p_from timestamptz default null) returns table (
  total_loss_rs numeric, value_in numeric, loss_pct numeric, lots bigint, open_alerts bigint, worst_centre_id uuid, worst_centre_name text, worst_centre_loss_rs numeric)
language sql stable as $$
  with seg as (select * from public.lot_segments where (p_org is null or org_id = p_org) and (p_from is null or ended_at >= p_from)),
  base as (select coalesce(sum(v.value_rs), 0) as v, count(*) as n from public.lot_start_value v where v.lot_id in (select lot_id from seg) ),
  worst as (select ce.id, ce.name, sum(s.total_loss_rs) as l from seg s join public.centres ce on ce.id = s.centre_id group by ce.id, ce.name order by l desc limit 1)
  select coalesce((select sum(total_loss_rs) from seg), 0), (select v from base),
    case when (select v from base) > 0 then round(coalesce((select sum(total_loss_rs) from seg), 0) / (select v from base) * 100, 2) else 0 end,
    (select n from base),
    (select count(*) from public.alerts a where a.acknowledged_at is null and (p_org is null or a.org_id = p_org)),
    (select id from worst), (select name from worst), (select round(l, 2) from worst)
$$;

create function public.stage_loss(p_org uuid default null, p_from timestamptz default null) returns table (
  kind text, segments bigint, lots bigint, weight_loss_kg numeric, weight_loss_rs numeric, quality_loss_rs numeric, total_loss_rs numeric, value_in numeric, loss_pct numeric)
language sql stable as $$
  select kind, count(*), count(distinct lot_id), sum(weight_loss_kg), sum(weight_loss_rs), sum(quality_loss_rs), sum(total_loss_rs), sum(value_from),
    case when sum(value_from) > 0 then round(sum(total_loss_rs) / sum(value_from) * 100, 2) else 0 end
  from public.lot_segments where (p_org is null or org_id = p_org) and (p_from is null or ended_at >= p_from) group by kind order by sum(total_loss_rs) desc
$$;

create function public.centre_loss(p_org uuid default null, p_from timestamptz default null) returns table (
  centre_id uuid, centre_name text, lots bigint, total_loss_rs numeric, waiting_loss_rs numeric, avg_wait_h numeric, value_in numeric, loss_pct numeric)
language sql stable as $$
  with seg as (select * from public.lot_segments where centre_id is not null and (p_org is null or org_id = p_org) and (p_from is null or ended_at >= p_from)),
  per as (select centre_id, sum(total_loss_rs) as l, sum(total_loss_rs) filter (where kind = 'waiting') as wl, avg(duration_h) filter (where kind = 'waiting') as w from seg group by centre_id),
  lots_per as (select distinct s.centre_id, s.lot_id from seg s),
  val as (select lp.centre_id, count(*) as n, sum(v.value_rs) as v from lots_per lp join public.lot_start_value v on v.lot_id = lp.lot_id group by lp.centre_id)
  select ce.id, ce.name, val.n, round(per.l, 2), round(coalesce(per.wl, 0), 2), round(coalesce(per.w, 0), 2), val.v,
    case when val.v > 0 then round(per.l / val.v * 100, 2) else 0 end
  from per join val using (centre_id) join public.centres ce on ce.id = per.centre_id order by per.l desc
$$;

create function public.transporter_loss(p_org uuid default null, p_from timestamptz default null) returns table (
  transporter_id uuid, transporter_name text, vehicle_no text, trips bigint, total_loss_rs numeric, avg_transport_h numeric, value_in numeric, loss_pct numeric)
language sql stable as $$
  select t.id, t.name, t.vehicle_no, count(*), round(sum(s.total_loss_rs), 2), round(avg(s.duration_h), 2), sum(s.value_from),
    case when sum(s.value_from) > 0 then round(sum(s.total_loss_rs) / sum(s.value_from) * 100, 2) else 0 end
  from public.lot_segments s join public.transporters t on t.id = s.transporter_id
  where s.kind = 'transport' and (p_org is null or s.org_id = p_org) and (p_from is null or s.ended_at >= p_from)
  group by t.id, t.name, t.vehicle_no order by sum(s.total_loss_rs) desc
$$;

-- Arrival hour in India time (UTC+5:30).
create function public.time_of_day_loss(p_org uuid default null, p_from timestamptz default null) returns table (
  arrival_hour int, segments bigint, avg_wait_h numeric, avg_heat_hours numeric, total_loss_rs numeric, value_in numeric, loss_pct numeric)
language sql stable as $$
  select extract(hour from s.started_at at time zone 'Asia/Kolkata')::int, count(*), round(avg(s.duration_h), 2), round(avg(coalesce(s.heat_hours, 0)), 2),
    round(sum(s.total_loss_rs), 2), sum(s.value_from), case when sum(s.value_from) > 0 then round(sum(s.total_loss_rs) / sum(s.value_from) * 100, 2) else 0 end
  from public.lot_segments s where s.kind = 'waiting' and (p_org is null or s.org_id = p_org) and (p_from is null or s.ended_at >= p_from)
  group by 1 order by 1
$$;

-- ---------------------------------------------------------------- public farmer report: one lot, farm-gate facts, unguessable token
create function public.get_public_lot_report(p_token text) returns table (
  short_code text, crop_name text, crop_name_te text, farmer_name text, village text, recorded_at timestamptz, weight_kg numeric,
  quality_good_pct numeric, quality_damaged_pct numeric, quality_rotten_pct numeric, quality_is_ai boolean, produce_photo_path text, org_name text, is_demo boolean)
language sql stable security definer set search_path = public as $$
  select l.short_code, cr.name, cr.name_te, f.name, f.village, c.device_captured_at, c.weight_kg, c.quality_good_pct, c.quality_damaged_pct, c.quality_rotten_pct,
    c.quality_is_ai, c.produce_photo_url, case when o.is_demo then o.name || ' (Simulated)' else o.name end, o.is_demo
  from public.lots l join public.checkpoints c on c.lot_id = l.id and c.stage = 'farm_pickup'
  join public.crops cr on cr.id = l.crop_id join public.farmers f on f.id = l.farmer_id join public.organizations o on o.id = l.org_id
  where length(p_token) >= 32 and l.public_token = p_token order by c.device_captured_at limit 1
$$;
grant execute on function public.get_public_lot_report(text) to anon, authenticated;

-- ---------------------------------------------------------------- server helpers
create function public.take_ai_budget(p_task text, p_limit integer) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer; begin
  insert into public.ai_usage (day, task, count) values (current_date, p_task, 1)
  on conflict (day, task) do update set count = public.ai_usage.count + 1 where public.ai_usage.count < p_limit returning count into n;
  return n is not null; end $$;

create function public.create_telegram_link() returns text language plpgsql security definer set search_path = public as $$
declare t text := encode(gen_random_bytes(16), 'hex'); begin
  if public.auth_role() <> 'manager' then raise exception 'managers only'; end if;
  update public.organizations set telegram_link_token = t where id = public.auth_org(); return t; end $$;
create function public.telegram_status() returns boolean language sql stable security definer set search_path = public as
$$ select telegram_chat_id is not null from public.organizations where id = public.auth_org() $$;
create function public.link_telegram_chat(p_token text, p_chat bigint) returns boolean language plpgsql security definer set search_path = public as $$
declare n int; begin
  update public.organizations set telegram_chat_id = p_chat, telegram_link_token = null where telegram_link_token = p_token and length(p_token) >= 16;
  get diagnostics n = row_count; return n > 0; end $$;

create view public.checkpoints_missing_exposure with (security_invoker = true) as
select c.id, c.org_id, c.lot_id, c.device_captured_at from public.checkpoints c
where c.stage <> 'farm_pickup' and not exists (select 1 from public.segment_exposure x where x.to_checkpoint_id = c.id);

revoke all on function public.take_ai_budget(text, integer), public.link_telegram_chat(text, bigint) from public, anon, authenticated;
grant execute on function public.take_ai_budget(text, integer), public.link_telegram_chat(text, bigint) to service_role;
revoke all on function public.create_telegram_link(), public.telegram_status() from public, anon;
grant execute on function public.create_telegram_link(), public.telegram_status() to authenticated, service_role;
grant select on public.lot_segments, public.lot_start_value, public.waiting_lots, public.checkpoints_missing_exposure to authenticated, service_role;
grant execute on function public.dashboard_kpis(uuid, timestamptz), public.stage_loss(uuid, timestamptz), public.centre_loss(uuid, timestamptz),
  public.transporter_loss(uuid, timestamptz), public.time_of_day_loss(uuid, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------- photo storage: private bucket, organisation folders, daily cap
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg']) on conflict (id) do nothing;
create function public.photo_daily_cap() returns int language sql immutable as $$ select 2000 $$;
create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.auth_org()::text);
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.auth_org()::text
    and (select count(*) from storage.objects o where o.bucket_id = 'photos' and o.name like public.auth_org()::text || '/%' and o.created_at > now() - interval '1 day') < public.photo_daily_cap());
