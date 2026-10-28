-- Demo mode only: stands in for the parts of Supabase that schema.sql
-- expects (the auth schema, auth.uid() and the anon/authenticated roles),
-- so the real schema can run inside the browser with PGlite.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('demo.uid', true), '')::uuid
$$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
