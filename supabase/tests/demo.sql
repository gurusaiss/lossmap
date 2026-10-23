\set ON_ERROR_STOP on
create function pg_temp.expect(cond boolean, label text) returns void language plpgsql as $$ begin if cond then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if; end $$;
create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', uid::text, false); execute 'set role authenticated'; end $$;
insert into auth.users (id, email) values ('de900000-0000-4000-8000-000000000001', 'dm@x');
insert into profiles (user_id, org_id, role, name) values ('de900000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'manager', 'Demo Manager');
select pg_temp.act_as('de900000-0000-4000-8000-000000000001');
select pg_temp.expect((select lots from dashboard_kpis()) = 114, 'the demo has 114 lots');
select pg_temp.expect((select count(*) from waiting_lots) = 2, 'two lots are still waiting at the centre');
select pg_temp.expect((select loss_pct from centre_loss() where centre_name like 'Centre B%') > 2 * (select loss_pct from centre_loss() where centre_name like 'Centre A%'), 'through the real views, Centre B loses more than twice the share of value Centre A does');
select pg_temp.expect((select kind from stage_loss() order by total_loss_rs desc limit 1) = 'waiting', 'waiting at the centre is the biggest loss stage');
select pg_temp.expect((select avg(loss_pct) from time_of_day_loss() where arrival_hour between 12 and 15) > 2 * (select avg(loss_pct) from time_of_day_loss() where arrival_hour between 7 and 9), 'afternoon arrivals lose more than twice the morning share');
select pg_temp.expect((select loss_pct from dashboard_kpis()) between 3 and 15, 'headline loss share is plausible (between 3% and 15%)');
reset role;
select pg_temp.expect((select count(*) from organizations where is_demo) = 1 and (select count(*) from checkpoints where org_id = 'de000000-0000-4000-8000-000000000001' and flags <> '{}') = 0, 'only the demo organisation is flagged and its generated checkpoints carry no flags');
select pg_temp.expect((select count(*) from lot_segments) > 0, 'the service role reads the segments');
select demo_reset('de000000-0000-4000-8000-000000000001');
select pg_temp.expect((select count(*) from lots where org_id = 'de000000-0000-4000-8000-000000000001') = 0, 'reset removes the simulated data');
select pg_temp.expect((select count(*) from organizations where id = 'a0000000-0000-0000-0000-000000000001') = 1, 'and leaves other organisations alone');
do $$ begin begin perform demo_reset('a0000000-0000-0000-0000-000000000001'); raise exception 'FAIL reset of a real organisation succeeded'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS  demo_reset refuses a non-demo organisation'; end; end $$;
\echo ALL DEMO TESTS PASSED
