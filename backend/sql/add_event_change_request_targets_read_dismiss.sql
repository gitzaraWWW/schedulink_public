alter table event_change_request_targets
  add column if not exists read_at timestamptz null,
  add column if not exists dismissed_at timestamptz null;

create index if not exists idx_event_change_request_targets_target_user_visible
  on event_change_request_targets (target_user_id, dismissed_at, read_at);
