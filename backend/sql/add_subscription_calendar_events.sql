create table if not exists public.subscription_calendar_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  subscription_code text not null,
  provider text not null,
  external_event_id text not null,
  title text not null,
  description text null,
  start_date date not null,
  end_date date not null,
  detail_url text null,
  image_url text null,
  google_event_id text null,
  calendar_id text not null default 'primary',
  sync_status text not null default 'synced',
  raw_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_calendar_events_pkey primary key (id),
  constraint subscription_calendar_events_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade,
  constraint subscription_calendar_events_subscription_code_fkey
    foreign key (subscription_code) references public.subscription_catalog(code) on delete cascade,
  constraint subscription_calendar_events_user_provider_external_key
    unique (user_id, provider, external_event_id)
);

create index if not exists idx_subscription_calendar_events_user_subscription
  on public.subscription_calendar_events (user_id, subscription_code, start_date asc);

create index if not exists idx_subscription_calendar_events_google_event
  on public.subscription_calendar_events (google_event_id);

alter table public.subscription_calendar_events disable row level security;
