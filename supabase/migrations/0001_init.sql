-- Coach Jay — v1 schema
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type user_role as enum ('coach', 'student');
create type session_source as enum ('manual', 'kit', 'bay_import');
create type video_kind as enum ('swing', 'lesson');

-- ---------- Profiles (one per auth user) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'student',
  full_name text not null default '',
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a user signs up.
-- Role and name come from signup metadata: { role, full_name }.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student'),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Students (a coach's roster) ----------
-- A student row can exist before the student has an account (invite flow):
-- user_id is filled when they sign up with the invite email.
create table students (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  email text not null,
  full_name text not null,
  goal text not null default '',
  focus text not null default '',
  handicap numeric(4,1),
  next_lesson_at timestamptz,
  created_at timestamptz not null default now(),
  unique (coach_id, email)
);
create index on students (coach_id);
create index on students (user_id);

-- Link a student row to the account when the student signs up.
create or replace function link_student_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update students set user_id = new.id
  where user_id is null and lower(email) = lower((select email from auth.users where id = new.id));
  return new;
end $$;

create trigger on_profile_created_link_student
  after insert on profiles
  for each row execute function link_student_on_signup();

-- ---------- Sessions & shots ----------
create table sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  coach_id uuid not null references profiles(id) on delete cascade,
  session_date date not null default current_date,
  source session_source not null default 'manual',
  title text not null default '',
  note text not null default '',            -- the note the student sees
  created_at timestamptz not null default now()
);
create index on sessions (student_id, session_date desc);

-- One row per shot. Manual entry creates one "shot" per club with the session averages.
create table shots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  club text not null,
  hit_at timestamptz not null default now(),
  club_speed numeric(5,1),      -- mph
  ball_speed numeric(5,1),      -- mph
  smash_factor numeric(4,2),
  launch_angle numeric(4,1),    -- degrees
  launch_direction numeric(4,1),
  spin_rate integer,            -- rpm
  spin_axis numeric(4,1),
  face_angle numeric(4,1),
  attack_angle numeric(4,1),
  club_path numeric(4,1),
  carry numeric(5,1),           -- yards
  total numeric(5,1),
  side numeric(5,1),            -- yards, + right
  apex numeric(5,1),
  raw jsonb                     -- untouched payload from KIT / import
);
create index on shots (session_id);

-- Per-session, per-club averages used by every chart.
create view session_club_averages as
select
  s.id as session_id, s.student_id, s.session_date, s.source,
  sh.club,
  count(*) as shots,
  round(avg(sh.club_speed)::numeric, 1) as club_speed,
  round(avg(sh.ball_speed)::numeric, 1) as ball_speed,
  round(avg(sh.smash_factor)::numeric, 2) as smash_factor,
  round(avg(sh.launch_angle)::numeric, 1) as launch_angle,
  round(avg(sh.spin_rate)::numeric) as spin_rate,
  round(avg(sh.carry)::numeric, 1) as carry,
  round(avg(sh.total)::numeric, 1) as total
from sessions s join shots sh on sh.session_id = s.id
group by s.id, s.student_id, s.session_date, s.source, sh.club;

-- ---------- Videos ----------
create table videos (
  id uuid primary key default gen_random_uuid(),
  kind video_kind not null,
  coach_id uuid not null references profiles(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,  -- null for lessons
  storage_path text not null,       -- bucket-relative path
  title text not null,
  category text not null default '', -- lessons: Fundamentals / Irons / Driver / Data / Playing
  description text not null default '',
  coach_note text not null default '',
  recorded_on date not null default current_date,
  duration_seconds integer,
  created_at timestamptz not null default now()
);
create index on videos (student_id);
create index on videos (coach_id, kind);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  watched_at timestamptz,
  unique (video_id, student_id)
);

-- ---------- Bridge tokens (KIT laptop -> API) ----------
create table bridge_tokens (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references profiles(id) on delete cascade,
  label text not null default 'KIT bridge',
  token_hash text not null unique,   -- sha256 of the token; token itself shown once
  active_student_id uuid references students(id) on delete set null,
  active_session_id uuid references sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- ---------- Helpers ----------
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function my_student_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from students where user_id = auth.uid()
$$;

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table students enable row level security;
alter table sessions enable row level security;
alter table shots enable row level security;
alter table videos enable row level security;
alter table assignments enable row level security;
alter table bridge_tokens enable row level security;

create policy "own profile" on profiles for select using (id = auth.uid());
create policy "update own profile" on profiles for update using (id = auth.uid());

create policy "coach manages roster" on students for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "student sees self" on students for select
  using (user_id = auth.uid());

create policy "coach manages sessions" on sessions for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "student reads own sessions" on sessions for select
  using (student_id in (select my_student_ids()));

create policy "coach manages shots" on shots for all
  using (exists (select 1 from sessions s where s.id = session_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = session_id and s.coach_id = auth.uid()));
create policy "student reads own shots" on shots for select
  using (exists (select 1 from sessions s where s.id = session_id and s.student_id in (select my_student_ids())));

create policy "coach manages videos" on videos for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "student reads own swings" on videos for select
  using (kind = 'swing' and student_id in (select my_student_ids()));
create policy "student reads assigned lessons" on videos for select
  using (kind = 'lesson' and exists (
    select 1 from assignments a where a.video_id = videos.id and a.student_id in (select my_student_ids())));

create policy "coach manages assignments" on assignments for all
  using (exists (select 1 from students st where st.id = student_id and st.coach_id = auth.uid()))
  with check (exists (select 1 from students st where st.id = student_id and st.coach_id = auth.uid()));
create policy "student reads own assignments" on assignments for select
  using (student_id in (select my_student_ids()));
create policy "student marks watched" on assignments for update
  using (student_id in (select my_student_ids()));

create policy "coach manages bridge tokens" on bridge_tokens for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- ---------- Storage ----------
-- Two private buckets. Playback uses signed URLs minted server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('swings',  'swings',  false, 524288000, array['video/mp4','video/quicktime','video/webm']),
  ('lessons', 'lessons', false, 2147483648, array['video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;

-- Only coaches write to storage, and only under their own folder: <coach_id>/...
create policy "coach uploads own folder" on storage.objects for insert
  with check (bucket_id in ('swings','lessons') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "coach reads own folder" on storage.objects for select
  using (bucket_id in ('swings','lessons') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "coach deletes own folder" on storage.objects for delete
  using (bucket_id in ('swings','lessons') and (storage.foldername(name))[1] = auth.uid()::text);
-- Students never touch storage directly; the app signs URLs for videos they are allowed to see.
