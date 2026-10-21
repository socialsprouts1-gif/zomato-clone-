#!/usr/bin/env bash
# DEV ONLY: apply migrations that aren't recorded yet, then reload PostgREST's schema cache.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB=thaali
psql_db() { su postgres -c "PGOPTIONS=--client-min-messages=warning psql -v ON_ERROR_STOP=1 -q -d $DB $*"; }
psql_db "-c 'create schema if not exists dev; create table if not exists dev.migrations (name text primary key, applied_at timestamptz default now())'"
for f in "$ROOT"/supabase/migrations/*.sql; do
  name=$(basename "$f")
  done=$(su postgres -c "psql -d $DB -At -c \"select 1 from dev.migrations where name = '$name'\"")
  [ "$done" = "1" ] && continue
  echo "• applying $name"
  psql_db "-f '$f'"
  psql_db "-c \"insert into dev.migrations (name) values ('$name')\""
done
su postgres -c "PGOPTIONS=--client-min-messages=warning psql -q -d $DB -f '$ROOT/scripts/dev-stack/realtime-triggers.sql'"
psql_db "-c \"notify pgrst, 'reload schema'\""
echo "✓ migrations up to date"
