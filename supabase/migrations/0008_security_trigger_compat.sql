-- CMS Supabase migration 0008
-- The generic author/publisher trigger must work safely across tables with
-- different actor column names. Accessing NEW.author_id directly from a
-- generic trigger can fail at runtime because TG_TABLE_NAME does not change
-- the record's compile-time field shape.

create or replace function public.validate_author_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  actor_text text;
  actor_id uuid;
  user_church bigint;
begin
  row_data := to_jsonb(new);

  if tg_table_name = 'announcements' then
    actor_text := row_data ->> 'author_id';
  elsif tg_table_name in ('websites', 'public_sites') then
    actor_text := row_data ->> 'published_by';
  end if;

  if actor_text is not null and actor_text <> '' then
    actor_id := actor_text::uuid;
    select church_id into user_church
    from public.profiles
    where id = actor_id;

    perform public.assert_same_church(
      new.church_id,
      user_church,
      tg_table_name || '.actor'
    );
  end if;

  return new;
end;
$$;

revoke all on function public.validate_author_tenant() from public;
