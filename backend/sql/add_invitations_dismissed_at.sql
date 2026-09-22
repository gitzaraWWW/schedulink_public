alter table invitations
  add column if not exists dismissed_at timestamptz null;

create index if not exists idx_invitations_participant_visible
  on invitations (participant_id, dismissed_at, status);
