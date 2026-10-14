-- CMS Supabase migration 0003
-- Complete announcement CRUD policy for admin/superadmin.

create policy announcements_insert_admin on public.announcements
for insert with check (
  church_id = public.current_church_id() and public.is_admin_or_superadmin()
);

create policy announcements_update_admin on public.announcements
for update using (
  church_id = public.current_church_id() and public.is_admin_or_superadmin()
) with check (
  church_id = public.current_church_id()
);

create policy announcements_delete_superadmin on public.announcements
for delete using (
  church_id = public.current_church_id() and public.is_superadmin()
);
