create table if not exists public.subscription_catalog (
  id uuid not null default gen_random_uuid(),
  code text not null,
  name text not null,
  category text not null,
  description text null,
  accent_key text null,
  icon_url text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_catalog_pkey primary key (id),
  constraint subscription_catalog_code_key unique (code)
);

create index if not exists idx_subscription_catalog_active_sort
  on public.subscription_catalog (is_active, sort_order asc, created_at asc);

create table if not exists public.user_subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  subscription_id uuid not null,
  created_at timestamptz not null default now(),
  constraint user_subscriptions_pkey primary key (id),
  constraint user_subscriptions_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade,
  constraint user_subscriptions_subscription_id_fkey
    foreign key (subscription_id) references public.subscription_catalog(id) on delete cascade,
  constraint user_subscriptions_user_subscription_key
    unique (user_id, subscription_id)
);

create index if not exists idx_user_subscriptions_user_created
  on public.user_subscriptions (user_id, created_at desc);

create index if not exists idx_user_subscriptions_subscription_created
  on public.user_subscriptions (subscription_id, created_at desc);

alter table public.subscription_catalog disable row level security;
alter table public.user_subscriptions disable row level security;

insert into public.subscription_catalog (
  code,
  name,
  category,
  description,
  accent_key,
  icon_url,
  sort_order
)
values
  ('maplestory', '메이플스토리', 'MMORPG', '추후 업데이트 예정', 'orange', null, 10),
  ('game_a', '게임A', 'MOBA', '추후 업데이트 예정', 'gold', null, 20),
  ('game_b', '게임B', 'FPS', '추후 업데이트 예정', 'rose', null, 30),
  ('game_c', '게임C', 'RPG', '추후 업데이트 예정', 'violet', null, 40),
  ('ai_content_engineering', 'AI콘텐츠공학과', '학과', '추후 업데이트 예정', 'mint', null, 50)
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  accent_key = excluded.accent_key,
  icon_url = excluded.icon_url,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
