create table if not exists chat_conversations (
  id uuid not null default gen_random_uuid(),
  owner_user_id uuid not null,
  title text not null default '새 대화'::text,
  last_message_preview text null,
  last_message_at timestamptz null,
  mode text not null default 'edit'::text
    check (mode = any (array['edit'::text, 'query'::text])),
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_conversations_pkey primary key (id),
  constraint chat_conversations_owner_user_id_fkey
    foreign key (owner_user_id) references public.users(id) on delete cascade
);

create index if not exists idx_chat_conversations_owner_visible
  on chat_conversations (owner_user_id, is_deleted, is_archived, updated_at desc);

create index if not exists idx_chat_conversations_owner_deleted_at
  on chat_conversations (owner_user_id, deleted_at);

create table if not exists chat_messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  client_message_id text null,
  role text not null
    check (role = any (array['user'::text, 'assistant'::text, 'system'::text])),
  kind text not null default 'text'::text
    check (
      kind = any (
        array[
          'text'::text,
          'intro'::text,
          'result'::text,
          'error'::text,
          'ownership-required'::text
        ]
      )
    ),
  status text not null default 'complete'::text
    check (status = any (array['pending'::text, 'complete'::text, 'error'::text])),
  content text not null default ''::text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_conversation_id_fkey
    foreign key (conversation_id) references public.chat_conversations(id) on delete cascade
);

create index if not exists idx_chat_messages_conversation_created
  on chat_messages (conversation_id, created_at asc, id asc);

create unique index if not exists idx_chat_messages_client_message_id
  on chat_messages (conversation_id, client_message_id)
  where client_message_id is not null;
