-- CMS Supabase migration 0009
-- Maps legacy Firebase Auth UIDs to Supabase Auth UUIDs.
-- This table is migration-only and is intentionally not exposed through RLS policies.

create table public.firebase_uid_map (
  legacy_uid text primary key,
  auth_user_id uuid not null unique
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.firebase_uid_map enable row level security;

comment on table public.firebase_uid_map is
  'Migration-only mapping between legacy Firebase Auth UIDs and Supabase Auth UUIDs.';
