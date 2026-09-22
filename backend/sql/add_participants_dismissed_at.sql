alter table participants
  add column if not exists dismissed_at timestamptz null;

create index if not exists idx_participants_user_visible
  on participants (user_id, dismissed_at, status);
