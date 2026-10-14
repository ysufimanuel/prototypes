-- CMS Supabase migration 0002
-- Tenant isolation + role permissions.
-- Public website projections are intentionally anonymous-read only.

create or replace function public.current_church_id()
returns bigint
language sql stable security definer set search_path = public
as $$ select church_id from public.profiles where id = auth.uid(); $$;

create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role() = 'superadmin', false); $$;

create or replace function public.is_admin_or_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role() in ('admin','superadmin'), false); $$;

do $$ declare t text; begin
 foreach t in array array[
  'churches','profiles','members','families','family_members','groups','group_members','events','event_participants','attendance',
  'donors','donations','volunteers','assignments','finance_categories','finance_config','income_transactions','expense_transactions',
  'approval_history','announcements','notifications','notification_recipients','messages','deaths','websites','website_pages',
  'website_navigation','site_slugs','public_sites','public_site_pages','public_site_events'
 ] loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;

-- Core identity.
create policy profiles_select_self_or_admin on public.profiles for select using (
 id = auth.uid() or (church_id = public.current_church_id() and public.is_admin_or_superadmin())
);
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy churches_select_tenant on public.churches for select using (id = public.current_church_id());
create policy churches_insert_superadmin on public.churches for insert with check (public.is_superadmin());
create policy churches_update_superadmin on public.churches for update using (id = public.current_church_id() and public.is_superadmin()) with check (id = public.current_church_id());
create policy churches_delete_superadmin on public.churches for delete using (id = public.current_church_id() and public.is_superadmin());

-- Direct tenant tables: user=read, admin=read/write, superadmin=read/write/delete.
do $$ declare t text; begin
 foreach t in array array['members','families','groups','events','attendance','donors','donations','volunteers','assignments','announcements','deaths','finance_categories','finance_config'] loop
  execute format('create policy %I_select on public.%I for select using (church_id = public.current_church_id())',t,t);
  execute format('create policy %I_insert_admin on public.%I for insert with check (church_id = public.current_church_id() and public.is_admin_or_superadmin())',t,t);
  execute format('create policy %I_update_admin on public.%I for update using (church_id = public.current_church_id() and public.is_admin_or_superadmin()) with check (church_id = public.current_church_id())',t,t);
  execute format('create policy %I_delete_superadmin on public.%I for delete using (church_id = public.current_church_id() and public.is_superadmin())',t,t);
 end loop;
end $$;

-- Normalized child tables inherit tenant scope from their parent.
create policy family_members_select on public.family_members for select using (
 exists (select 1 from public.families f where f.id = family_id and f.church_id = public.current_church_id())
);
create policy family_members_insert_admin on public.family_members for insert with check (
 public.is_admin_or_superadmin() and exists (select 1 from public.families f where f.id = family_id and f.church_id = public.current_church_id())
 and exists (select 1 from public.members m where m.id = member_id and m.church_id = public.current_church_id())
);
create policy family_members_delete_superadmin on public.family_members for delete using (
 public.is_superadmin() and exists (select 1 from public.families f where f.id = family_id and f.church_id = public.current_church_id())
);

create policy group_members_select on public.group_members for select using (
 exists (select 1 from public.groups g where g.id = group_id and g.church_id = public.current_church_id())
);
create policy group_members_insert_admin on public.group_members for insert with check (
 public.is_admin_or_superadmin() and exists (select 1 from public.groups g where g.id = group_id and g.church_id = public.current_church_id())
 and exists (select 1 from public.members m where m.id = member_id and m.church_id = public.current_church_id())
);
create policy group_members_delete_superadmin on public.group_members for delete using (
 public.is_superadmin() and exists (select 1 from public.groups g where g.id = group_id and g.church_id = public.current_church_id())
);

create policy event_participants_select on public.event_participants for select using (
 exists (select 1 from public.events e where e.id = event_id and e.church_id = public.current_church_id())
);
create policy event_participants_insert_admin on public.event_participants for insert with check (
 public.is_admin_or_superadmin() and exists (select 1 from public.events e where e.id = event_id and e.church_id = public.current_church_id())
);
create policy event_participants_update_admin on public.event_participants for update using (
 public.is_admin_or_superadmin() and exists (select 1 from public.events e where e.id = event_id and e.church_id = public.current_church_id())
) with check (exists (select 1 from public.events e where e.id = event_id and e.church_id = public.current_church_id()));
create policy event_participants_delete_superadmin on public.event_participants for delete using (
 public.is_superadmin() and exists (select 1 from public.events e where e.id = event_id and e.church_id = public.current_church_id())
);

-- Finance approval: admin can work on pending rows; only superadmin can approve/delete.
create policy income_select on public.income_transactions for select using (church_id = public.current_church_id());
create policy income_insert_admin on public.income_transactions for insert with check (church_id = public.current_church_id() and public.is_admin_or_superadmin());
create policy income_update_pending on public.income_transactions for update using (
 church_id = public.current_church_id() and public.is_admin_or_superadmin() and (status = 'pending' or public.is_superadmin())
) with check (church_id = public.current_church_id());
create policy income_delete_superadmin on public.income_transactions for delete using (church_id = public.current_church_id() and public.is_superadmin());

create policy expense_select on public.expense_transactions for select using (church_id = public.current_church_id());
create policy expense_insert_admin on public.expense_transactions for insert with check (church_id = public.current_church_id() and public.is_admin_or_superadmin());
create policy expense_update_pending on public.expense_transactions for update using (
 church_id = public.current_church_id() and public.is_admin_or_superadmin() and (status = 'pending' or public.is_superadmin())
) with check (church_id = public.current_church_id());
create policy expense_delete_superadmin on public.expense_transactions for delete using (church_id = public.current_church_id() and public.is_superadmin());

create policy approval_history_select on public.approval_history for select using (church_id = public.current_church_id());
create policy approval_history_insert_superadmin on public.approval_history for insert with check (church_id = public.current_church_id() and public.is_superadmin());
create policy approval_history_delete_superadmin on public.approval_history for delete using (church_id = public.current_church_id() and public.is_superadmin());

-- Communication.
create policy notifications_select on public.notifications for select using (church_id = public.current_church_id());
create policy notifications_insert_admin on public.notifications for insert with check (church_id = public.current_church_id() and public.is_admin_or_superadmin());
create policy notifications_delete_superadmin on public.notifications for delete using (church_id = public.current_church_id() and public.is_superadmin());
create policy notification_recipients_select_self on public.notification_recipients for select using (user_id = auth.uid());
create policy notification_recipients_update_self on public.notification_recipients for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy messages_select_participant on public.messages for select using (
 church_id = public.current_church_id() and (sender_id = auth.uid() or receiver_id = auth.uid())
);
create policy messages_insert_sender on public.messages for insert with check (church_id = public.current_church_id() and sender_id = auth.uid());
create policy messages_update_participant on public.messages for update using (
 church_id = public.current_church_id() and (sender_id = auth.uid() or receiver_id = auth.uid())
) with check (church_id = public.current_church_id());
create policy messages_delete_superadmin on public.messages for delete using (church_id = public.current_church_id() and public.is_superadmin());

-- Website source: tenant admins only. Pages/navigation are scoped through website_id.
create policy websites_select on public.websites for select using (church_id = public.current_church_id());
create policy websites_insert_admin on public.websites for insert with check (church_id = public.current_church_id() and public.is_admin_or_superadmin());
create policy websites_update_admin on public.websites for update using (church_id = public.current_church_id() and public.is_admin_or_superadmin()) with check (church_id = public.current_church_id());
create policy websites_delete_superadmin on public.websites for delete using (church_id = public.current_church_id() and public.is_superadmin());

create policy website_pages_select on public.website_pages for select using (
 exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id())
);
create policy website_pages_insert_admin on public.website_pages for insert with check (
 public.is_admin_or_superadmin() and exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id())
);
create policy website_pages_update_admin on public.website_pages for update using (
 public.is_admin_or_superadmin() and exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id())
) with check (exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id()));
create policy website_pages_delete_superadmin on public.website_pages for delete using (
 public.is_superadmin() and exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id())
);

create policy website_navigation_select on public.website_navigation for select using (
 exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id())
);
create policy website_navigation_insert_admin on public.website_navigation for insert with check (
 public.is_admin_or_superadmin() and exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id())
);
create policy website_navigation_update_admin on public.website_navigation for update using (
 public.is_admin_or_superadmin() and exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id())
) with check (exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id()));
create policy website_navigation_delete_superadmin on public.website_navigation for delete using (
 public.is_superadmin() and exists (select 1 from public.websites w where w.id = website_id and w.church_id = public.current_church_id())
);

create policy site_slugs_select_public on public.site_slugs for select using (true);
create policy site_slugs_write_admin on public.site_slugs for insert with check (church_id = public.current_church_id() and public.is_admin_or_superadmin());
create policy site_slugs_update_admin on public.site_slugs for update using (church_id = public.current_church_id() and public.is_admin_or_superadmin()) with check (church_id = public.current_church_id());
create policy site_slugs_delete_superadmin on public.site_slugs for delete using (church_id = public.current_church_id() and public.is_superadmin());

-- Public projection: anonymous SELECT only. Publishing should be done by a trusted server/RPC.
create policy public_sites_public_read on public.public_sites for select using (true);
create policy public_site_pages_public_read on public.public_site_pages for select using (true);
create policy public_site_events_public_read on public.public_site_events for select using (true);