\set ON_ERROR_STOP on
create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', uid::text, false); execute 'set role authenticated'; end $$;
create function pg_temp.reset() returns void language plpgsql as $$ begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', false); end $$;
create function pg_temp.expect(cond boolean, label text) returns void language plpgsql as $$ begin if cond then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if; end $$;
create function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$ begin
  begin execute sql; exception when others then raise notice 'PASS  % (%)', label, sqlerrm; return; end; raise exception 'FAIL  % : unexpectedly succeeded', label; end $$;

insert into organizations (id, name) values ('a0000000-0000-0000-0000-000000000001', 'Org A'), ('b0000000-0000-0000-0000-000000000001', 'Org B');
insert into auth.users (id, email) values ('a1000000-0000-0000-0000-000000000001', 'am@x'), ('a1000000-0000-0000-0000-000000000002', 'aa@x'), ('b1000000-0000-0000-0000-000000000001', 'bm@x');
insert into profiles (user_id, org_id, role, name) values
 ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'manager', 'A Mgr'),
 ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'field_agent', 'A Agent'),
 ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'manager', 'B Mgr');
insert into farmers (id, org_id, name, village) values ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ravi', 'V1'), ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Other', 'V9');
insert into crops (id, org_id, name, code_prefix, price_per_kg, max_safe_wait_hours) values ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Tomato', 'T', 20, 3), ('b3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Tomato', 'T', 20, 3);
insert into centres (id, org_id, name, type, lat, lng, radius_m) values ('a4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Centre A', 'collection_centre', 13.55, 78.5, 300);

-- agent captures a lot: 248 kg -> 240 kg over a 5 h wait with quality 90/8 -> 65/25 (hand-calculated: 150.40 + 792.00)
select pg_temp.act_as('a1000000-0000-0000-0000-000000000002');
insert into lots (id, org_id, short_code, qr_code, farmer_id, crop_id) values ('a5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'T-AAAAA', 'T-AAAAA', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001');
insert into checkpoints (id, org_id, lot_id, stage, centre_id, weight_kg, quality_good_pct, quality_damaged_pct, quality_rotten_pct, lat, lng, device_captured_at) values
 ('a6000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'farm_pickup', null, 250, 90, 8, 2, 13.5, 78.4, now() - interval '9 hours'),
 ('a6000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'centre_arrival', 'a4000000-0000-0000-0000-000000000001', 248, 90, 8, 2, 13.55, 78.5, now() - interval '8 hours'),
 ('a6000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'centre_dispatch', 'a4000000-0000-0000-0000-000000000001', 240, 65, 25, 10, 14.0, 79.0, now() - interval '3 hours');
select pg_temp.expect((select flags from checkpoints where id = 'a6000000-0000-0000-0000-000000000003') @> array['gps_far'], 'server flags a checkpoint far from its centre (computed by the server, not the client)');
select pg_temp.expect((select flags from checkpoints where id = 'a6000000-0000-0000-0000-000000000001') = array[]::text[], 'a clean checkpoint has no flags');
select pg_temp.expect((select count(*) from lot_segments) = 0, 'field agents see no loss analytics');
select pg_temp.expect((select count(*) from dashboard_kpis() where lots > 0) = 0, 'field agents get no dashboard numbers');
select pg_temp.expect_fail($q$insert into crops (org_id, name, price_per_kg) values ('a0000000-0000-0000-0000-000000000001', 'Mango', 30)$q$, 'agent cannot create crops');
select pg_temp.expect_fail($q$insert into lots (org_id, short_code, qr_code, farmer_id, crop_id) values ('a0000000-0000-0000-0000-000000000001', 'T-X', 'T-X', 'b2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001')$q$, 'a lot cannot reference another organisation''s farmer');
update checkpoints set weight_kg = 1;
select pg_temp.expect((select min(weight_kg) from checkpoints) = 240, 'agent cannot edit recorded weights (the update touches 0 rows)');
select pg_temp.expect_fail($q$insert into checkpoints (org_id, lot_id, stage, weight_kg, scale_photo_url, device_captured_at) values ('a0000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'factory_arrival', 10, 'b0000000-0000-0000-0000-000000000001/x.jpg', now())$q$, 'photo path must be inside the organisation folder');
select pg_temp.expect_fail($q$select telegram_chat_id from organizations$q$, 'chat id is not readable by browsers');
select pg_temp.reset();

select pg_temp.act_as('a1000000-0000-0000-0000-000000000001');
select pg_temp.expect((select count(*) from lot_segments) = 2, 'manager sees the two segments of the lot');
select pg_temp.expect((select weight_loss_rs from lot_segments where kind = 'waiting') = 150.40, 'weight loss 8 kg x 20 x 0.94 = 150.40 (matches the TypeScript unit test)');
select pg_temp.expect((select quality_loss_rs from lot_segments where kind = 'waiting') = 792.00, 'quality loss (0.94 - 0.775) x 240 x 20 = 792.00');
select pg_temp.expect((select total_loss_rs from lot_segments where kind = 'waiting') = 942.40, 'total 942.40');
select pg_temp.expect((select cause_rule from lot_segments where kind = 'waiting') = 'R2_waited_too_long', 'a 5 h wait with no heat data is "waited too long", not heat');
select pg_temp.expect((select total_loss_rs from dashboard_kpis()) = (select sum(total_loss_rs) from lot_segments), 'dashboard total equals the sum of segments');
select pg_temp.expect((select value_in from dashboard_kpis()) = 4700 * 1 - 0 + 0 or (select value_in from dashboard_kpis()) = round(250 * 20 * 0.94, 2), 'whole-lot base is the farm-gate value counted once (250 kg x 20 x 0.94 = 4,700)');
select pg_temp.expect((select count(*) from waiting_lots) = 0, 'a lot already dispatched is not "waiting now"');
update checkpoints set weight_kg = 241 where id = 'a6000000-0000-0000-0000-000000000003';
select pg_temp.expect((select count(*) from audit_log where row_id = 'a6000000-0000-0000-0000-000000000003' and field = 'weight_kg') = 1, 'a manager''s weight correction is written to the audit log');
select pg_temp.expect((select flags from checkpoints where id = 'a6000000-0000-0000-0000-000000000003') @> array['weight_edited'], 'and the checkpoint is flagged weight_edited by the server');
select pg_temp.expect_fail($q$update checkpoints set scale_photo_url = 'a0000000-0000-0000-0000-000000000001/new.jpg' where id = 'a6000000-0000-0000-0000-000000000003'$q$, 'evidence photos are immutable even for managers');
select pg_temp.reset();

select pg_temp.act_as('b1000000-0000-0000-0000-000000000001');
select pg_temp.expect((select count(*) from lots) = 0 and (select count(*) from checkpoints) = 0 and (select count(*) from lot_segments) = 0 and (select count(*) from farmers) = 1, 'organisation B sees none of organisation A''s data');
select pg_temp.reset();

-- disabling a person ends access at once
update profiles set disabled = true where user_id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.act_as('a1000000-0000-0000-0000-000000000001');
select pg_temp.expect((select count(*) from lots) = 0 and (select count(*) from profiles) = 0, 'a disabled manager sees nothing, even with a valid token');
select pg_temp.reset();

-- public report: needs the unguessable token
select pg_temp.expect((select count(*) from get_public_lot_report('short')) = 0, 'a short token returns nothing');
select pg_temp.expect((select count(*) from get_public_lot_report((select public_token from lots limit 1))) = 1, 'the lot''s token returns its farm-gate report');
select pg_temp.expect(has_function_privilege('anon', 'take_ai_budget(text,integer)', 'execute') = false, 'anonymous users cannot spend the AI budget');
-- scheduled jobs run as the service role and must still see the views
set role service_role;
select pg_temp.expect((select count(*) from lot_segments) = 2, 'the service role (scheduled jobs) can read the loss views');
select pg_temp.expect((select count(*) from dashboard_kpis('a0000000-0000-0000-0000-000000000001')) = 1, 'and can scope them to one organisation');
reset role;
\echo ALL DB TESTS PASSED
