begin;

create extension if not exists pgtap;

select plan(23);

-- Deterministic fixtures. The test transaction is rolled back at the end.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
 ('00000000-0000-0000-0000-000000000001','authenticated','authenticated','sa-a@example.test','x',now()),
 ('00000000-0000-0000-0000-000000000002','authenticated','authenticated','admin-a@example.test','x',now()),
 ('00000000-0000-0000-0000-000000000003','authenticated','authenticated','user-a@example.test','x',now()),
 ('00000000-0000-0000-0000-000000000004','authenticated','authenticated','user-b@example.test','x',now())
on conflict (id) do nothing;

insert into public.churches (id, legacy_id, nama, superadmin_uid)
values
 (910001, 'test-church-a', 'Test Church A', '00000000-0000-0000-0000-000000000001'),
 (910002, 'test-church-b', 'Test Church B', null)
on conflict (id) do nothing;

insert into public.profiles (id, church_id, nama, username, email, role)
values
 ('00000000-0000-0000-0000-000000000001',910001,'Superadmin A','sa-a','sa-a@example.test','superadmin'),
 ('00000000-0000-0000-0000-000000000002',910001,'Admin A','admin-a','admin-a@example.test','admin'),
 ('00000000-0000-0000-0000-000000000003',910001,'User A','user-a','user-a@example.test','user'),
 ('00000000-0000-0000-0000-000000000004',910002,'User B','user-b','user-b@example.test','user')
on conflict (id) do nothing;

insert into public.members (id, church_id, nama, email)
values (910101,910001,'Member A','member-a@example.test'), (910102,910002,'Member B','member-b@example.test')
on conflict (id) do nothing;

insert into public.groups (id, church_id, nama)
values (910201,910001,'Group A'), (910202,910002,'Group B')
on conflict (id) do nothing;

insert into public.events (id, church_id, nama)
values (910301,910001,'Event A'), (910302,910002,'Event B')
on conflict (id) do nothing;

insert into public.finance_categories (id, church_id, nama, tipe)
values (910401,910001,'Income A','income'), (910402,910002,'Income B','income')
on conflict (id) do nothing;

insert into public.websites (id, church_id, site_name)
values (910501,910001,'Site A'), (910502,910002,'Site B')
on conflict (id) do nothing;

insert into public.public_sites (id, church_id, config)
values (910601,910001,'{"siteName":"Public A"}'::jsonb), (910602,910002,'{"siteName":"Public B"}'::jsonb)
on conflict (id) do nothing;

insert into public.notifications (id, church_id, title, message)
values (910701,910001,'Notice A','Hello A')
on conflict (id) do nothing;

insert into public.notification_recipients (notification_id, user_id)
values (910701,'00000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into public.messages (id, church_id, sender_id, receiver_id, content)
values (910801,910001,'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','hello')
on conflict (id) do nothing;

-- User A: tenant isolation + read-only permissions.
set role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',true);

select is((select public.current_church_id()), 910001::bigint, 'current_church_id follows auth.uid');
select is((select count(*) from public.members), 1::bigint, 'user sees only own church members');
select is((select count(*) from public.members where church_id=910002), 0::bigint, 'user cannot read another church');
select is((select count(*) from public.public_sites), 2::bigint, 'public projection is readable across churches');
select throws_ok($$insert into public.members (church_id,nama) values (910001,'blocked')$$, '42501', null, 'user cannot insert CMS data');
select is((select count(*) from public.members where id=910101), 1::bigint, 'user cannot delete CMS data');

-- Admin A: can write own tenant but cannot cross tenant.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$insert into public.members (id,church_id,nama) values (910111,910001,'Admin-created')$$, 'admin can insert in own church');
select lives_ok($$update public.members set nama='Admin-updated' where id=910111$$, 'admin can update own church');
select throws_ok($$insert into public.members (id,church_id,nama) values (910112,910002,'Cross-tenant')$$, '42501', null, 'admin cannot insert another church');
select throws_ok($$update public.members set church_id=910002 where id=910111$$, '42501', null, 'admin cannot move row to another church');
select is((select count(*) from public.members where id=910111), 1::bigint, 'admin cannot delete rows');

-- Cross-tenant relational integrity: RLS blocks the cross-tenant write before a relation can be attached.
select throws_ok($$insert into public.group_members (group_id,member_id) values (910201,910102)$$, '42501', null, 'group membership rejects cross-tenant member');
select throws_ok($$insert into public.event_participants (event_id,member_id,nama) values (910301,910102,'Member B')$$, '42501', null, 'event participant rejects cross-tenant member');
select throws_ok($$insert into public.donations (church_id,donor_id,jumlah) values (910001,910102,10)$$, '42501', null, 'donation rejects cross-tenant donor');

-- Finance: admin may create pending, but cannot approve or forge approval metadata.
select lives_ok($$insert into public.income_transactions (id,church_id,jumlah,status) values (910901,910001,100,'pending')$$, 'admin can create pending income');
select throws_ok($$update public.income_transactions set status='approved' where id=910901$$, '42501', null, 'admin cannot approve finance transaction');
select throws_ok($$insert into public.income_transactions (id,church_id,jumlah,status,approved_by,approved_at) values (910902,910001,100,'approved','00000000-0000-0000-0000-000000000002',now())$$, '42501', null, 'admin cannot forge approved income');

-- Switch back to the actual receiver before exercising the read RPC.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',true);

-- Message read state is narrowed to the receiver through an RPC.
select lives_ok($$select public.mark_message_read(910801)$$, 'receiver can mark own message read');
select is((select read from public.messages where id=910801), true, 'message read flag changed');

-- Notification read state is narrowed to the recipient through an RPC.
select lives_ok($$select public.mark_notification_read(910701)$$, 'recipient can mark own notification read');
select is((select read from public.notification_recipients where notification_id=910701 and user_id='00000000-0000-0000-0000-000000000003'), true, 'notification read flag changed');

-- Anonymous users can read only public projections, not tenant data.
reset role;
set role anon;
select set_config('request.jwt.claims','{}',true);
select is((select count(*) from public.public_sites), 2::bigint, 'anonymous can read public sites');
select is((select count(*) from public.members), 0::bigint, 'anonymous cannot read tenant data');

reset role;
select * from finish();
rollback;
