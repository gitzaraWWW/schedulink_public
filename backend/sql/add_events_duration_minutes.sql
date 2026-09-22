alter table events
add column if not exists duration_minutes integer null;

update events
set duration_minutes = case
  when start_time is null then null
  when end_time is null then 60
  when end_time::time <= start_time::time then
    ((extract(epoch from ((end_time::time + interval '1 day') - start_time::time)) / 60))::integer
  else
    ((extract(epoch from (end_time::time - start_time::time)) / 60))::integer
end
where duration_minutes is null;
