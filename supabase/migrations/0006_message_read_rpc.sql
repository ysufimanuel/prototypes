-- CMS Supabase migration 0006
-- Receivers mark messages read through a narrow RPC instead of a broad UPDATE policy.

drop policy if exists messages_mark_read_receiver on public.messages;

create or replace function public.mark_message_read(p_message_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages
  set read = true,
      updated_at = now()
  where id = p_message_id
    and receiver_id = auth.uid()
    and church_id = public.current_church_id();
end;
$$;

revoke all on function public.mark_message_read(bigint) from public;
grant execute on function public.mark_message_read(bigint) to authenticated;
