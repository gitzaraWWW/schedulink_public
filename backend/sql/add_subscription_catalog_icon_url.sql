alter table public.subscription_catalog
  add column if not exists icon_url text null;
