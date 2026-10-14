begin;

create extension if not exists pgtap;

select plan(8);

insert into public.churches (id, legacy_id, nama)
values
  (920001, 'tenant-a', 'Tenant A'),
  (920002, 'tenant-b', 'Tenant B')
on conflict (id) do nothing;

select lives_ok($$insert into public.members (id, church_id, legacy_id, nama) values (920101,920001,'1','Member A')$$, 'member legacy id 1 allowed in tenant A');
select lives_ok($$insert into public.members (id, church_id, legacy_id, nama) values (920102,920002,'1','Member B')$$, 'same member legacy id 1 allowed in tenant B');
select throws_ok($$insert into public.members (id, church_id, legacy_id, nama) values (920103,920001,'1','Duplicate A')$$, '23505', null, 'duplicate member legacy id rejected inside same tenant');

select lives_ok($$insert into public.groups (id, church_id, legacy_id, nama) values (920201,920001,'1','Group A')$$, 'group legacy id 1 allowed in tenant A');
select lives_ok($$insert into public.groups (id, church_id, legacy_id, nama) values (920202,920002,'1','Group B')$$, 'same group legacy id 1 allowed in tenant B');
select throws_ok($$insert into public.groups (id, church_id, legacy_id, nama) values (920203,920001,'1','Duplicate Group A')$$, '23505', null, 'duplicate group legacy id rejected inside same tenant');

select lives_ok($$insert into public.finance_categories (id, church_id, legacy_id, nama, tipe) values (920301,920001,'1','Category A','income')$$, 'finance category legacy id 1 allowed in tenant A');
select lives_ok($$insert into public.finance_categories (id, church_id, legacy_id, nama, tipe) values (920302,920002,'1','Category B','income')$$, 'same finance category legacy id allowed in tenant B');

select * from finish();
rollback;
