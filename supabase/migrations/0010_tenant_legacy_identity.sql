-- CMS Supabase migration 0010
-- Firebase tenant document IDs are only unique inside a church.
-- Keep global collections globally unique, but scope tenant legacy IDs by church.

alter table public.income_transactions
  add column if not exists donatur_member_id bigint references public.members(id) on delete set null;

DO $$
DECLARE
  table_name text;
  constraint_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'members',
    'families',
    'groups',
    'events',
    'attendance',
    'donors',
    'donations',
    'volunteers',
    'assignments',
    'finance_categories',
    'income_transactions',
    'expense_transactions',
    'approval_history',
    'announcements',
    'notifications',
    'deaths'
  ] LOOP
    constraint_name := table_name || '_legacy_id_key';
    EXECUTE format('alter table public.%I drop constraint if exists %I', table_name, constraint_name);
    EXECUTE format(
      'alter table public.%I add constraint %I unique (church_id, legacy_id)',
      table_name,
      table_name || '_church_legacy_id_key'
    );
  END LOOP;
END $$;

create index if not exists income_transactions_donatur_member_id_idx
  on public.income_transactions(donatur_member_id);
