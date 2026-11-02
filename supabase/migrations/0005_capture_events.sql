-- Coach Jay — v1.5: capture events for the GoPro helper
-- When the phone saves a swing (auto-capture or manual), it announces it here with the swing id.
-- The laptop helper (gopro/helper.py, authenticated with a bridge token) claims the event,
-- triggers the GoPro, downloads the clip and attaches it to the same swing.
-- Run in the Supabase SQL editor.

create table if not exists capture_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  swing_id uuid not null,
  club text not null default '',
  angle_needed text not null default 'Down-the-line',
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  done_at timestamptz,
  error text
);
create index if not exists capture_events_coach_open_idx on capture_events (coach_id, created_at desc) where done_at is null;

alter table capture_events enable row level security;
create policy "coach manages capture events" on capture_events for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
