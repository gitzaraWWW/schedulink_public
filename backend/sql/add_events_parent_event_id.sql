alter table events
add column if not exists parent_event_id uuid null references events(id) on delete set null;

create index if not exists events_parent_event_id_idx
on events(parent_event_id);
