-- Coach Jay — v1.6: the Clubhouse (community) + Welcome hub
-- Free sign-up for anyone (adults only), a community feed, Ask the Coach Q&A, chat channels,
-- free "tips" from the lesson library, and lesson requests from new members.
-- Run in the Supabase SQL editor after 0005_capture_events.sql. Safe to re-run.

-- =====================================================================
-- 1. Lock down roles now that sign-up is open to the public
-- =====================================================================
-- Before this, the signup form let anyone pick "Coach", and the "update own profile" policy let a user
-- change their own role. With open sign-up that would hand out coach (moderator) powers to strangers.

-- New sign-ups are always students. Coaches are promoted by hand in the SQL editor:
--   update profiles set role = 'coach' where id = '<user id>';
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name)
  values (new.id, 'student', coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

alter table profiles
  add column if not exists about text not null default '',
  add column if not exists home_course text not null default '',
  add column if not exists agreed_rules_at timestamptz,   -- accepted Clubhouse rules + confirmed 18+
  add column if not exists banned_at timestamptz;

-- Only a coach (or the SQL editor / service role, where auth.uid() is null) may change role or ban status.
create or replace function guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.banned_at is distinct from old.banned_at)
     and auth.uid() is not null
     and coalesce((select role from profiles where id = auth.uid()), 'student') <> 'coach' then
    raise exception 'Not allowed to change role or ban status';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_privileges on profiles;
create trigger guard_profile_privileges before update on profiles
  for each row execute function guard_profile_privileges();

-- Members can see each other's name, role, about and home course (needed to show who posted what).
drop policy if exists "members see profiles" on profiles;
create policy "members see profiles" on profiles for select to authenticated using (true);

-- ---------- Helpers ----------
create or replace function is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'coach' from profiles where id = auth.uid()), false)
$$;

-- Can post: agreed to the rules and not banned. Coaches always can.
create or replace function is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'coach' or (agreed_rules_at is not null and banned_at is null)
                   from profiles where id = auth.uid()), false)
$$;

-- Coach-only: ban / unban a member (their posts stay until deleted).
create or replace function set_member_ban(member uuid, banned boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_coach() then raise exception 'Coaches only'; end if;
  update profiles set banned_at = case when banned then now() else null end
  where id = member and role <> 'coach';
end $$;

-- =====================================================================
-- 2. Free tips: lessons the coach marks free show on the Welcome hub for everyone
-- =====================================================================
alter table videos add column if not exists is_free boolean not null default false;
drop policy if exists "members read free lessons" on videos;
create policy "members read free lessons" on videos for select to authenticated
  using (kind = 'lesson' and is_free);

-- =====================================================================
-- 3. Clubhouse tables
-- =====================================================================
create table if not exists club_channels (
  slug text primary key,
  name text not null,
  description text not null default '',
  sort integer not null default 0,
  coach_only boolean not null default false   -- only the coach posts (announcements)
);
insert into club_channels (slug, name, description, sort, coach_only) values
  ('announcements',  'Announcements',  'News from Coach Jay — clinics, openings, events.', 0, true),
  ('general',        'General',        'Anything golf. Say hi.', 1, false),
  ('introductions',  'Introductions',  'New here? Tell us your game: handicap, home course, what you''re working on.', 2, false),
  ('range-sessions', 'Range sessions', 'Share what you worked on and what clicked.', 3, false),
  ('find-a-foursome','Find a foursome','Looking for a playing partner or a group? Post it here.', 4, false)
on conflict (slug) do nothing;

-- Feed posts and Ask-the-Coach questions share one table.
create table if not exists club_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'post' check (kind in ('post', 'question')),
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  media_path text,                                   -- clubhouse bucket, <author_id>/...
  media_type text check (media_type in ('image', 'video')),
  pinned boolean not null default false,
  answered_at timestamptz,                           -- questions: set when the coach answers
  created_at timestamptz not null default now()
);
create index if not exists club_posts_feed_idx on club_posts (kind, pinned desc, created_at desc);

create table if not exists club_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references club_posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  is_coach_answer boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists club_comments_post_idx on club_comments (post_id, created_at);

create table if not exists club_likes (
  post_id uuid not null references club_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists club_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null references club_channels(slug) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists club_messages_channel_idx on club_messages (channel, created_at desc);

create table if not exists club_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  post_id uuid references club_posts(id) on delete cascade,
  comment_id uuid references club_comments(id) on delete cascade,
  message_id uuid references club_messages(id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (num_nonnulls(post_id, comment_id, message_id) = 1)
);

-- "Request a lesson" from the Welcome hub. Back Nine still books and collects payment.
create table if not exists lesson_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  phone text not null default '',
  message text not null default '',
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

-- A coach answer marks the question answered.
create or replace function mark_question_answered() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_coach_answer then
    update club_posts set answered_at = coalesce(answered_at, now()) where id = new.post_id and kind = 'question';
  end if;
  return new;
end $$;
drop trigger if exists club_comment_answers on club_comments;
create trigger club_comment_answers after insert on club_comments
  for each row execute function mark_question_answered();

-- =====================================================================
-- 4. Row-level security
-- =====================================================================
alter table club_channels enable row level security;
alter table club_posts enable row level security;
alter table club_comments enable row level security;
alter table club_likes enable row level security;
alter table club_messages enable row level security;
alter table club_reports enable row level security;
alter table lesson_requests enable row level security;

drop policy if exists "read channels" on club_channels;
create policy "read channels" on club_channels for select to authenticated using (true);

-- Posts
drop policy if exists "read posts" on club_posts;
drop policy if exists "write own posts" on club_posts;
drop policy if exists "coach updates posts" on club_posts;
drop policy if exists "delete own or coach" on club_posts;
create policy "read posts" on club_posts for select to authenticated using (true);
create policy "write own posts" on club_posts for insert to authenticated
  with check (author_id = auth.uid() and is_active_member() and answered_at is null
              and (not pinned or is_coach())
              and (media_path is null or (storage.foldername(media_path))[1] = auth.uid()::text));
create policy "coach updates posts" on club_posts for update to authenticated using (is_coach()) with check (is_coach());
create policy "delete own or coach" on club_posts for delete to authenticated using (author_id = auth.uid() or is_coach());

-- Comments
drop policy if exists "read comments" on club_comments;
drop policy if exists "write own comments" on club_comments;
drop policy if exists "delete own or coach" on club_comments;
create policy "read comments" on club_comments for select to authenticated using (true);
create policy "write own comments" on club_comments for insert to authenticated
  with check (author_id = auth.uid() and is_active_member() and (not is_coach_answer or is_coach()));
create policy "delete own or coach" on club_comments for delete to authenticated using (author_id = auth.uid() or is_coach());

-- Likes
drop policy if exists "read likes" on club_likes;
drop policy if exists "like" on club_likes;
drop policy if exists "unlike" on club_likes;
create policy "read likes" on club_likes for select to authenticated using (true);
create policy "like" on club_likes for insert to authenticated with check (user_id = auth.uid() and is_active_member());
create policy "unlike" on club_likes for delete to authenticated using (user_id = auth.uid());

-- Chat
drop policy if exists "read messages" on club_messages;
drop policy if exists "write own messages" on club_messages;
drop policy if exists "delete own or coach" on club_messages;
create policy "read messages" on club_messages for select to authenticated using (true);
create policy "write own messages" on club_messages for insert to authenticated
  with check (author_id = auth.uid() and is_active_member()
              and (is_coach() or not exists (select 1 from club_channels c where c.slug = channel and c.coach_only)));
create policy "delete own or coach" on club_messages for delete to authenticated using (author_id = auth.uid() or is_coach());

-- Reports: anyone can file; only the coach reads and resolves.
drop policy if exists "file report" on club_reports;
drop policy if exists "coach reads reports" on club_reports;
drop policy if exists "coach resolves reports" on club_reports;
create policy "file report" on club_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "coach reads reports" on club_reports for select to authenticated using (is_coach());
create policy "coach resolves reports" on club_reports for update to authenticated using (is_coach()) with check (is_coach());

-- Lesson requests
drop policy if exists "request lesson" on lesson_requests;
drop policy if exists "see own or coach" on lesson_requests;
drop policy if exists "coach handles requests" on lesson_requests;
create policy "request lesson" on lesson_requests for insert to authenticated with check (user_id = auth.uid());
create policy "see own or coach" on lesson_requests for select to authenticated using (user_id = auth.uid() or is_coach());
create policy "coach handles requests" on lesson_requests for update to authenticated using (is_coach()) with check (is_coach());

-- =====================================================================
-- 5. Storage: photos and short clips members attach to posts
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clubhouse', 'clubhouse', false, 104857600,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;

drop policy if exists "members upload to own clubhouse folder" on storage.objects;
drop policy if exists "members read clubhouse" on storage.objects;
drop policy if exists "delete own clubhouse media or coach" on storage.objects;
create policy "members upload to own clubhouse folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'clubhouse' and (storage.foldername(name))[1] = auth.uid()::text and is_active_member());
create policy "members read clubhouse" on storage.objects for select to authenticated
  using (bucket_id = 'clubhouse');
create policy "delete own clubhouse media or coach" on storage.objects for delete to authenticated
  using (bucket_id = 'clubhouse' and ((storage.foldername(name))[1] = auth.uid()::text or is_coach()));

-- =====================================================================
-- 6. Live chat: stream new messages to open chat screens
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'club_messages') then
    alter publication supabase_realtime add table club_messages;
  end if;
end $$;
