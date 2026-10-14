-- CMS Supabase migration 0005
-- Tighten message mutation scope, finance status transitions, and SECURITY DEFINER search paths.

-- A receiver may mark a message read, but must not edit sender/content.
drop policy if exists messages_update_participant on public.messages;
create policy messages_update_sender on public.messages
for update using (
  church_id = public.current_church_id() and sender_id = auth.uid()
) with check (
  church_id = public.current_church_id() and sender_id = auth.uid()
);

create policy messages_mark_read_receiver on public.messages
for update using (
  church_id = public.current_church_id() and receiver_id = auth.uid()
) with check (
  church_id = public.current_church_id() and receiver_id = auth.uid() and read = true
);

-- Keep finance state transitions explicit. Admins may create/edit pending rows;
-- only superadmins may move a row out of pending.
create or replace function public.enforce_finance_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.status not in ('pending','approved','rejected') then
    raise exception 'invalid finance status' using errcode = '23514';
  end if;

  if not public.is_superadmin() then
    if new.status <> 'pending' then
      raise exception 'only superadmin may approve or reject finance transactions' using errcode = '42501';
    end if;
    new.approved_by := null;
    new.approved_at := null;
  elsif new.status = 'approved' then
    new.approved_by := auth.uid();
    if new.approved_at is null then
      new.approved_at := now();
    end if;
  elsif new.status = 'rejected' then
    new.approved_by := null;
    new.approved_at := null;
  end if;

  return new;
end;
$$;

-- Pin every SECURITY DEFINER function to an empty search_path. This prevents
-- callers from influencing name resolution while the function runs with owner privileges.
alter function public.current_church_id() set search_path = '';
alter function public.current_role() set search_path = '';
alter function public.is_superadmin() set search_path = '';
alter function public.is_admin_or_superadmin() set search_path = '';
alter function public.assert_same_church(bigint,bigint,text) set search_path = '';
alter function public.validate_member_group_relation() set search_path = '';
alter function public.validate_family_head_relation() set search_path = '';
alter function public.validate_group_leader_relation() set search_path = '';
alter function public.validate_family_member_relation() set search_path = '';
alter function public.validate_group_member_relation() set search_path = '';
alter function public.validate_event_participant_relation() set search_path = '';
alter function public.validate_attendance_relation() set search_path = '';
alter function public.validate_donation_relation() set search_path = '';
alter function public.validate_volunteer_relation() set search_path = '';
alter function public.validate_assignment_relation() set search_path = '';
alter function public.validate_finance_relation() set search_path = '';
alter function public.enforce_finance_approval() set search_path = '';
alter function public.validate_notification_recipient_relation() set search_path = '';
alter function public.validate_message_participants() set search_path = '';
alter function public.validate_author_tenant() set search_path = '';

-- Keep the trigger function internal.
revoke all on function public.enforce_finance_approval() from public;
