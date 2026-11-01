-- Coach Jay — v1.4: one swing, several views
-- Clips of the same swing (face-on, down-the-line) share a swing_id, so the lesson shows
-- one entry per swing with both views side by side.
-- Run in the Supabase SQL editor.

alter table videos add column if not exists swing_id uuid;
alter table videos add column if not exists angle text;
update videos set swing_id = id where swing_id is null;
update videos set angle = case when title ilike '%down-the-line%' then 'Down-the-line' when title ilike '%face-on%' then 'Face-on' else null end where angle is null;
create index if not exists videos_swing_id_idx on videos (swing_id);
