-- DEV ONLY: hosted Supabase streams changes via logical replication.
-- Locally, tables in the supabase_realtime publication pg_notify the gateway instead.
create schema if not exists dev_realtime;

create or replace function dev_realtime.notify() returns trigger language plpgsql security definer as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  old_rec jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  body text;
begin
  body := json_build_object('schema', tg_table_schema, 'table', tg_table_name, 'type', tg_op,
    'record', rec, 'old_record', old_rec, 'commit_timestamp', now())::text;
  if octet_length(body) > 7900 then
    -- pg_notify payloads are capped at 8000 bytes; send keys only and let the gateway refetch.
    body := json_build_object('schema', tg_table_schema, 'table', tg_table_name, 'type', tg_op,
      'record', case when rec is null then null else jsonb_build_object('id', rec->'id') end,
      'old_record', case when old_rec is null then null else jsonb_build_object('id', old_rec->'id') end,
      'truncated', true, 'commit_timestamp', now())::text;
  end if;
  perform pg_notify('dev_realtime', body);
  return null;
end $$;

do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' loop
    execute format('drop trigger if exists dev_realtime_notify on %I.%I', r.schemaname, r.tablename);
    execute format('create trigger dev_realtime_notify after insert or update or delete on %I.%I for each row execute function dev_realtime.notify()', r.schemaname, r.tablename);
  end loop;
end $$;
