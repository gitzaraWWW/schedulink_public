alter table users
  add column if not exists profile_change_count integer not null default 0,
  add column if not exists profile_change_started_at timestamptz null;
