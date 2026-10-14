-- CMS Supabase migration 0004
-- Security hardening for profile RBAC, cross-tenant relations, and finance approval.

-- A client must never be able to change its own role or church membership.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_superadmin on public.profiles
for update using (
  public.is_superadmin() and church_id = public.current_church_id()
) with check (
  public.is_superadmin() and church_id = public.current_church_id()
);

-- RLS helper functions are policy internals, not public API.
revoke all on function public.current_church_id() from public;
revoke all on function public.current_role() from public;
revoke all on function public.is_superadmin() from public;
revoke all on function public.is_admin_or_superadmin() from public;
grant execute on function public.current_church_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_admin_or_superadmin() to authenticated;

-- Cross-tenant relational integrity. Foreign keys guarantee existence, but they do
-- not guarantee that both rows belong to the same church. These triggers do.
create or replace function public.assert_same_church(
  child_church_id bigint,
  parent_church_id bigint,
  relation_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if child_church_id is null or parent_church_id is null or child_church_id <> parent_church_id then
    raise exception 'cross-tenant relation rejected: %', relation_name
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.validate_member_group_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_church bigint;
begin
  if new.group_id is not null then
    select church_id into parent_church from public.groups where id = new.group_id;
    perform public.assert_same_church(new.church_id, parent_church, 'members.group_id');
  end if;
  return new;
end;
$$;
create or replace function public.validate_family_head_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_church bigint;
begin
  if new.kepala_id is not null then
    select church_id into parent_church from public.members where id = new.kepala_id;
    perform public.assert_same_church(new.church_id, parent_church, 'families.kepala_id');
  end if;
  return new;
end;
$$;
create or replace function public.validate_group_leader_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_church bigint;
begin
  if new.leader_id is not null then
    select church_id into parent_church from public.members where id = new.leader_id;
    perform public.assert_same_church(new.church_id, parent_church, 'groups.leader_id');
  end if;
  return new;
end;
$$;

create or replace function public.validate_family_member_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare family_church bigint; member_church bigint;
begin
  select church_id into family_church from public.families where id = new.family_id;
  select church_id into member_church from public.members where id = new.member_id;
  perform public.assert_same_church(family_church, member_church, 'family_members');
  return new;
end;
$$;
create or replace function public.validate_group_member_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare group_church bigint; member_church bigint;
begin
  select church_id into group_church from public.groups where id = new.group_id;
  select church_id into member_church from public.members where id = new.member_id;
  perform public.assert_same_church(group_church, member_church, 'group_members');
  return new;
end;
$$;

create or replace function public.validate_event_participant_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare event_church bigint; member_church bigint;
begin
  select church_id into event_church from public.events where id = new.event_id;
  if new.member_id is not null then
    select church_id into member_church from public.members where id = new.member_id;
    perform public.assert_same_church(event_church, member_church, 'event_participants.member_id');
  end if;
  return new;
end;
$$;
create or replace function public.validate_attendance_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare event_church bigint; member_church bigint;
begin
  if new.event_id is not null then
    select church_id into event_church from public.events where id = new.event_id;
    perform public.assert_same_church(new.church_id, event_church, 'attendance.event_id');
  end if;
  if new.member_id is not null then
    select church_id into member_church from public.members where id = new.member_id;
    perform public.assert_same_church(new.church_id, member_church, 'attendance.member_id');
  end if;
  return new;
end;
$$;

create or replace function public.validate_donation_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare member_church bigint; donor_church bigint;
begin
  if new.donor_id is not null then
    select church_id into member_church from public.members where id = new.donor_id;
    perform public.assert_same_church(new.church_id, member_church, 'donations.donor_id');
  end if;
  if new.donor_record_id is not null then
    select church_id into donor_church from public.donors where id = new.donor_record_id;
    perform public.assert_same_church(new.church_id, donor_church, 'donations.donor_record_id');
  end if;
  return new;
end;
$$;
create or replace function public.validate_volunteer_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare member_church bigint;
begin
  if new.member_id is not null then
    select church_id into member_church from public.members where id = new.member_id;
    perform public.assert_same_church(new.church_id, member_church, 'volunteers.member_id');
  end if;
  return new;
end;
$$;
create or replace function public.validate_assignment_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare volunteer_church bigint; event_church bigint;
begin
  if new.volunteer_id is not null then
    select church_id into volunteer_church from public.volunteers where id = new.volunteer_id;
    perform public.assert_same_church(new.church_id, volunteer_church, 'assignments.volunteer_id');
  end if;
  if new.event_id is not null then
    select church_id into event_church from public.events where id = new.event_id;
    perform public.assert_same_church(new.church_id, event_church, 'assignments.event_id');
  end if;
  return new;
end;
$$;
create or replace function public.validate_finance_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare category_church bigint; donor_church bigint;
begin
  if new.kategori_id is not null then
    select church_id into category_church from public.finance_categories where id = new.kategori_id;
    perform public.assert_same_church(new.church_id, category_church, 'finance.kategori_id');
  end if;
  if tg_table_name = 'income_transactions' and new.donatur_id is not null then
    select church_id into donor_church from public.donors where id = new.donatur_id;
    perform public.assert_same_church(new.church_id, donor_church, 'income.donatur_id');
  end if;
  return new;
end;
$$;

create trigger members_group_tenant_check before insert or update on public.members
for each row execute function public.validate_member_group_relation();
create trigger families_head_tenant_check before insert or update on public.families
for each row execute function public.validate_family_head_relation();
create trigger groups_leader_tenant_check before insert or update on public.groups
for each row execute function public.validate_group_leader_relation();
create trigger family_members_tenant_check before insert or update on public.family_members
for each row execute function public.validate_family_member_relation();
create trigger group_members_tenant_check before insert or update on public.group_members
for each row execute function public.validate_group_member_relation();
create trigger event_participants_tenant_check before insert or update on public.event_participants
for each row execute function public.validate_event_participant_relation();
create trigger attendance_tenant_check before insert or update on public.attendance
for each row execute function public.validate_attendance_relation();
create trigger donations_tenant_check before insert or update on public.donations
for each row execute function public.validate_donation_relation();
create trigger volunteers_tenant_check before insert or update on public.volunteers
for each row execute function public.validate_volunteer_relation();
create trigger assignments_tenant_check before insert or update on public.assignments
for each row execute function public.validate_assignment_relation();
create trigger income_tenant_check before insert or update on public.income_transactions
for each row execute function public.validate_finance_relation();
create trigger expense_tenant_check before insert or update on public.expense_transactions
for each row execute function public.validate_finance_relation();

-- Prevent client-side admins from approving finance transactions or forging approval metadata.
create or replace function public.enforce_finance_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Trusted server/import operations may run without auth.uid().
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_superadmin() then
    if new.status <> 'pending' then
      raise exception 'only superadmin may approve finance transactions' using errcode = '42501';
    end if;
    new.approved_by := null;
    new.approved_at := null;
  elsif new.status = 'approved' then
    if new.approved_by is null then
      new.approved_by := auth.uid();
    end if;
    if new.approved_at is null then
      new.approved_at := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger income_approval_guard before insert or update on public.income_transactions
for each row execute function public.enforce_finance_approval();
create trigger expense_approval_guard before insert or update on public.expense_transactions
for each row execute function public.enforce_finance_approval();

-- Notifications may only be assigned to users in the same church as the notification.
create or replace function public.validate_notification_recipient_relation()
returns trigger language plpgsql security definer set search_path = public as $$
declare notification_church bigint; recipient_church bigint;
begin
  select church_id into notification_church from public.notifications where id = new.notification_id;
  select church_id into recipient_church from public.profiles where id = new.user_id;
  perform public.assert_same_church(notification_church, recipient_church, 'notification_recipients.user_id');
  return new;
end;
$$;
create trigger notification_recipient_tenant_check before insert or update on public.notification_recipients
for each row execute function public.validate_notification_recipient_relation();

-- Message participants must belong to the same church as the message.
create or replace function public.validate_message_participants()
returns trigger language plpgsql security definer set search_path = public as $$
declare sender_church bigint; receiver_church bigint;
begin
  if new.sender_id is not null then
    select church_id into sender_church from public.profiles where id = new.sender_id;
    perform public.assert_same_church(new.church_id, sender_church, 'messages.sender_id');
  end if;
  if new.receiver_id is not null then
    select church_id into receiver_church from public.profiles where id = new.receiver_id;
    perform public.assert_same_church(new.church_id, receiver_church, 'messages.receiver_id');
  end if;
  return new;
end;
$$;
create trigger messages_participant_tenant_check before insert or update on public.messages
for each row execute function public.validate_message_participants();

-- Auth-user references must not point at another tenant where the record carries church scope.
create or replace function public.validate_author_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
declare user_church bigint;
begin
  if tg_table_name = 'announcements' and new.author_id is not null then
    select church_id into user_church from public.profiles where id = new.author_id;
    perform public.assert_same_church(new.church_id, user_church, 'announcements.author_id');
  elsif tg_table_name = 'websites' and new.published_by is not null then
    select church_id into user_church from public.profiles where id = new.published_by;
    perform public.assert_same_church(new.church_id, user_church, 'websites.published_by');
  elsif tg_table_name = 'public_sites' and new.published_by is not null then
    select church_id into user_church from public.profiles where id = new.published_by;
    perform public.assert_same_church(new.church_id, user_church, 'public_sites.published_by');
  end if;
  return new;
end;
$$;
create trigger announcements_author_tenant_check before insert or update on public.announcements
for each row execute function public.validate_author_tenant();
create trigger websites_publisher_tenant_check before insert or update on public.websites
for each row execute function public.validate_author_tenant();
create trigger public_sites_publisher_tenant_check before insert or update on public.public_sites
for each row execute function public.validate_author_tenant();

-- Trigger functions are internal implementation details.
revoke all on function public.assert_same_church(bigint,bigint,text) from public;
revoke all on function public.validate_member_group_relation() from public;
revoke all on function public.validate_family_head_relation() from public;
revoke all on function public.validate_group_leader_relation() from public;
revoke all on function public.validate_family_member_relation() from public;
revoke all on function public.validate_group_member_relation() from public;
revoke all on function public.validate_event_participant_relation() from public;
revoke all on function public.validate_attendance_relation() from public;
revoke all on function public.validate_donation_relation() from public;
revoke all on function public.validate_volunteer_relation() from public;
revoke all on function public.validate_assignment_relation() from public;
revoke all on function public.validate_finance_relation() from public;
revoke all on function public.enforce_finance_approval() from public;
revoke all on function public.validate_notification_recipient_relation() from public;
revoke all on function public.validate_message_participants() from public;
revoke all on function public.validate_author_tenant() from public;
