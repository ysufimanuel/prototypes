begin;

create extension if not exists pgtap;

select plan(8);

-- Deterministic auth fixture. The test transaction is rolled back at the end.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000099','authenticated','authenticated','uid-map-test@example.test','x',now())
on conflict (id) do nothing;

insert into public.firebase_uid_map (legacy_uid, auth_user_id)
values ('firebase-test-legacy-uid','00000000-0000-0000-0000-000000000099')
on conflict (legacy_uid) do nothing;

-- The mapping table must be protected by RLS and intentionally have no client policies.
select ok(
  (select relrowsecurity from pg_class where oid='public.firebase_uid_map'::regclass),
  'firebase_uid_map has RLS enabled'
);
select is(
  (select count(*) from pg_policies where schemaname='public' and tablename='firebase_uid_map'),
  0::bigint,
  'firebase_uid_map has no client-facing RLS policies'
);

-- With RLS enabled and no policies, client roles are default-deny:
-- SELECT/UPDATE/DELETE are filtered to zero rows, while INSERT is rejected.
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}',true);
select is(
  (select count(*) from public.firebase_uid_map),
  0::bigint,
  'authenticated cannot read firebase UID mappings'
);
select throws_ok(
  $$insert into public.firebase_uid_map (legacy_uid,auth_user_id) values ('blocked-insert','00000000-0000-0000-0000-000000000099')$$,
  '42501', null,
  'authenticated cannot insert firebase UID mappings'
);

-- Data-modifying statements must be top-level in PostgreSQL. Execute them as
-- standalone statements, then assert that RLS filtered them to zero rows.
update public.firebase_uid_map
set legacy_uid='blocked-update'
where legacy_uid='firebase-test-legacy-uid';
select is(
  (select count(*) from public.firebase_uid_map where legacy_uid='blocked-update'),
  0::bigint,
  'authenticated cannot update firebase UID mappings'
);

delete from public.firebase_uid_map
where legacy_uid='firebase-test-legacy-uid';
select is(
  (select count(*) from public.firebase_uid_map where legacy_uid='firebase-test-legacy-uid'),
  0::bigint,
  'authenticated cannot delete firebase UID mappings'
);

-- Anonymous clients must not be able to read or insert mapping rows either.
reset role;
set role anon;
select set_config('request.jwt.claims','{}',true);
select is(
  (select count(*) from public.firebase_uid_map),
  0::bigint,
  'anonymous cannot read firebase UID mappings'
);
select throws_ok(
  $$insert into public.firebase_uid_map (legacy_uid,auth_user_id) values ('anon-blocked-insert','00000000-0000-0000-0000-000000000099')$$,
  '42501', null,
  'anonymous cannot insert firebase UID mappings'
);

reset role;
select * from finish();
rollback;
