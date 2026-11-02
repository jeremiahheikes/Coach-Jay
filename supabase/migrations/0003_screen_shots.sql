-- Coach Jay — v1.3: shots read off the bay screen
-- A capture card feeds the simulator's picture to the coach's laptop; the app reads the
-- shot panel and posts each shot as *provisional*. The official CSV import at close-out
-- replaces provisional shots in that session.
-- Run in the Supabase SQL editor after 0002.

alter type session_source add value if not exists 'screen';

alter table shots
  add column if not exists provisional boolean not null default false;

create index if not exists shots_session_provisional_idx on shots (session_id, provisional);
