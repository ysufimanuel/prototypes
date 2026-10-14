-- CMS Supabase migration 0007
-- Users mark only their own notification recipient row as read.

drop policy if exists notification_recipients_update_self on public.notification_recipients;

create or replace function public.mark_notification_read(p_notification_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_recipients
  set read = true,
      read_at = now()
  where notification_id = p_notification_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.mark_notification_read(bigint) from public;
grant execute on function public.mark_notification_read(bigint) to authenticated;
