alter table chat_conversations
  add column if not exists mode text not null default 'edit'::text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_conversations_mode_check'
  ) then
    alter table chat_conversations
      add constraint chat_conversations_mode_check
      check (mode = any (array['edit'::text, 'query'::text]));
  end if;
end $$;
