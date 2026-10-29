#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres database and runs the SQL assertions.
set -uo pipefail
cd "$(dirname "$0")"
DB=lossmap_test
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
as_pg "dropdb --if-exists $DB && createdb $DB" || exit 1
ROOT="$(cd ../.. && pwd)"
node "$ROOT/scripts/scenario-sql.ts" > /tmp/lossmap_demo_load.sql || exit 1
chmod 644 /tmp/lossmap_demo_load.sql
for f in shim.sql ../migrations/*.sql db.sql /tmp/lossmap_demo_load.sql demo.sql; do
  echo "== $f"
  out=$(as_pg "psql -X -t -A -v ON_ERROR_STOP=1 -d $DB -f $(realpath "$f")" 2>&1); st=$?
  echo "$out" | grep -E "PASS|FAIL|ALL [A-Z]+ TESTS|ERROR" | sed -E 's/^psql:[^ ]* //; s/^NOTICE:  //'
  if [ $st -ne 0 ]; then echo "!! $f failed"; echo "$out" | tail -5; exit $st; fi
done

# The real Edge Function code, run against the migrated database (a small adapter stands in for PostgREST and the auth admin API).
if [ "$(id -u)" = 0 ]; then
  as_pg "psql -tAc \"select 1 from pg_roles where rolname='root'\" | grep -q 1 || createuser -s root"
  export PGHOST=/var/run/postgresql PGUSER=root
fi
echo "== server.test.mjs"
PGDATABASE=$DB node "$ROOT/supabase/tests/server.test.mjs" 2>&1 | grep -vi "experimentalwarning\|--trace-warnings\|Use \`node\|MODULE_TYPELESS\|Reparsing\|eliminate\|add \"type\"" | sed -E 's/^/  /'
exit ${PIPESTATUS[0]}
