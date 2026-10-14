-- CMS Supabase migration 0004
-- Security hardening: prevent profile privilege escalation and cross-tenant foreign references.

-- Client users must never be able to change their own role/church through profiles.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_superadmin on public.profiles
for update using (
  public.is_superadmin() and church_id = public.current_church_id()
) with check (
  public.is_superadmin() and church_id = public.current_church_id()
);

-- These helper functions are policy internals; they are not public API functions.
revoke all on function public.current_church_id() from public;
revoke all on function public.current_role() from public;
revoke all on function public.is_superadmin() from public;
revoke all on function public.is_admin_or_superadmin() from public;
grant execute on function public.current_church_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_admin_or_superadmin() to authenticated;

-- RLS tenant checks do not automatically make ordinary foreign keys tenant-safe.
-- These triggers verify that referenced domain rows belong to NEW.church_id.
create or replace function public.assert_same_church_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_church_id bigint;
begin
  if tg_table_name = 'members' and new.group_id is not null then
    select church_id into ref_church_id from public.groups where id = new.group_id;
    if ref_church_id is distinct from new.church_id then
      raise exception 'cross-tenant group reference';
    end if;
  elsif tg_table_name = 'families' and new.kepala_id is not null then
    select church_id into ref_church_id from public.members where id = new.kepala_id;
    if ref_church_id is distinct from new.church_id then
      raise exception 'cross-tenant family head reference';
    end if;
  elsif tg_table_name = 'groups' and new.leader_id is not null then
    select church_id into ref_church_id from public.members where id = new.leader_id;
    if ref_church_id is distinct from new.church_id then
      raise exception 'cross-tenant group leader reference';
    end if;
  elsif tg_table_name = 'event_participants' and new.member_id is not null then
    select church_id into ref_church_id from public.members where id = new.member_id;
    if ref_church_id is distinct from (select church_id from public.events where id = new.event_id) then
      raise exception 'cross-tenant event participant reference';
    end if;
  elsif tg_table_name = 'attendance' then
    if new.event_id is not null then
      select church_id into ref_church_id from public.events where id = new.event_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant attendance event reference';
      end if;
    end if;
    if new.member_id is not null then
      select church_id into ref_church_id from public.members where id = new.member_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant attendance member reference';
      end if;
    end if;
  elsif tg_table_name = 'donations' then
    if new.donor_id is not null then
      select church_id into ref_church_id from public.members where id = new.donor_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant donation member donor reference';
      end if;
    end if;
    if new.donor_record_id is not null then
      select church_id into ref_church_id from public.donors where id = new.donor_record_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant donation donor reference';
      end if;
    end if;
  elsif tg_table_name = 'volunteers' and new.member_id is not null then
    select church_id into ref_church_id from public.members where id = new.member_id;
    if ref_church_id is distinct from new.church_id then
      raise exception 'cross-tenant volunteer member reference';
    end if;
  elsif tg_table_name = 'assignments' then
    if new.volunteer_id is not null then
      select church_id into ref_church_id from public.volunteers where id = new.volunteer_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant assignment volunteer reference';
      end if;
    end if;
    if new.event_id is not null then
      select church_id into ref_church_id from public.events where id = new.event_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant assignment event reference';
      end if;
    end if;
  elsif tg_table_name in ('income_transactions','expense_transactions') then
    if new.kategori_id is not null then
      select church_id into ref_church_id from public.finance_categories where id = new.kategori_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant finance category reference';
      end if;
    end if;
    if tg_table_name = 'income_transactions' and new.donatur_id is not null then
      select church_id into ref_church_id from public.donors where id = new.donatur_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant income donor reference';
      end if;
    end if;
  elsif tg_table_name = 'approval_history' and new.by_user_id is not null then
    select church_id into ref_church_id from public.profiles where id = new.by_user_id;
    if ref_church_id is distinct from new.church_id then
      raise exception 'cross-tenant approval actor reference';
    end if;
  elsif tg_table_name = 'notification_recipients' then
    select church_id into ref_church_id from public.notifications where id = new.notification_id;
    if ref_church_id is distinct from (select church_id from public.profiles where id = new.user_id) then
      raise exception 'cross-tenant notification recipient reference';
    end if;
  elsif tg_table_name = 'messages' then
    if new.sender_id is not null then
      select church_id into ref_church_id from public.profiles where id = new.sender_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant message sender reference';
      end if;
    end if;
    if new.receiver_id is not null then
      select church_id into ref_church_id from public.profiles where id = new.receiver_id;
      if ref_church_id is distinct from new.church_id then
        raise exception 'cross-tenant message receiver reference';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists members_same_church_refs on public.members;
create trigger members_same_church_refs before insert or update on public.members for each row execute function public.assert_same_church_refs();
drop trigger if exists families_same_church_refs on public.families;
create trigger families_same_church_refs before insert or update on public.families for each row execute function public.assert_same_church_refs();
drop trigger if exists groups_same_church_refs on public.groups;
create trigger groups_same_church_refs before insert or update on public.groups for each row execute function public.assert_same_church_refs();
drop trigger if exists event_participants_same_church_refs on public.event_participants;
create trigger event_participants_same_church_refs before insert or update on public.event_participants for each row execute function public.assert_same_church_refs();
drop trigger if exists attendance_same_church_refs on public.attendance;
create trigger attendance_same_church_refs before insert or update on public.attendance for each row execute function public.assert_same_church_refs();
drop trigger if exists donations_same_church_refs on public.donations;
create trigger donations_same_church_refs before insert or update on public.donations for each row execute function public.assert_same_church_refs();
drop trigger if exists volunteers_same_church_refs on public.volunteers;
create trigger volunteers_same_church_refs before insert or update on public.volunteers for each row execute function public.assert_same_church_refs();
drop trigger if exists assignments_same_church_refs on public.assignments;
create trigger assignments_same_church_refs before insert or update on public.assignments for each row execute function public.assert_same_church_refs();
drop trigger if exists income_same_church_refs on public.income_transactions;
create trigger income_same_church_refs before insert or update on public.income_transactions for each row execute function public.assert_same_church_refs();
drop trigger if exists expense_same_church_refs on public.expense_transactions;
create trigger expense_same_church_refs before insert or update on public.expense_transactions for each row execute function public.assert_same_church_refs();
drop trigger if exists approval_history_same_church_refs on public.approval_history;
create trigger approval_history_same_church_refs before insert or update on public.approval_history for each row execute function public.assert_same_church_refs();
drop trigger if exists notification_recipients_same_church_refs on public.notification_recipients;
create trigger notification_recipients_same_church_refs before insert or update on public.notification_recipients for each row execute function public.assert_same_church_refs();
drop trigger if exists messages_same_church_refs on public.messages;
create trigger messages_same_church_refs before insert or update on public.messages for each row execute function public.assert_same_church_refs();

revoke all on function public.assert_same_church_refs() from public;
grant execute on function public.assert_same_church_refs() to authenticated;
