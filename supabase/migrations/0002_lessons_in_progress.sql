-- Coach Jay — v1.2: lessons in progress
-- A session can now stay "open" during a lesson. Clips recorded during the lesson
-- attach to it (videos.session_id), and the live KIT / manual shots land in it,
-- so the lesson page can show each clip with the shots hit around it.
-- Run in the Supabase SQL editor after 0001_init.sql.

alter table sessions
  add column if not exists status text not null default 'closed' check (status in ('open', 'closed')),
  add column if not exists closed_at timestamptz;

alter table videos
  add column if not exists session_id uuid references sessions(id) on delete set null;

create index if not exists videos_session_id_idx on videos (session_id);
create index if not exists sessions_student_status_idx on sessions (student_id, status);
