create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text not null unique,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text not null default '';
update public.profiles set full_name = username where btrim(full_name) = '';
alter table public.profiles drop constraint if exists profiles_full_name_check;
alter table public.profiles
  add constraint profiles_full_name_check check (char_length(btrim(full_name)) between 2 and 100);

alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles drop constraint if exists profiles_username_format_check;
alter table public.profiles
  add constraint profiles_username_format_check
  check (username ~ '^[a-zA-Z0-9_]{3,32}$' or (lower(username) = 'ak' and role = 'admin'));

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  category text not null default 'General',
  description text not null,
  input_format text not null default '',
  output_format text not null default '',
  starter_code jsonb not null default '{}'::jsonb,
  time_limit integer not null default 2000 check (time_limit between 100 and 10000),
  memory_limit integer not null default 128 check (memory_limit between 16 and 1024),
  created_at timestamptz not null default now()
);

create table if not exists public.test_cases (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  input text not null,
  expected_output text not null,
  is_sample boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  language text not null check (language in ('python', 'javascript', 'cpp', 'java')),
  code text not null,
  status text not null check (status in ('Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error')),
  execution_time numeric,
  memory_used bigint,
  passed_tests integer not null default 0,
  total_tests integer not null default 0,
  created_at timestamptz not null default now()
);

-- Add new columns and migrate data when upgrading an earlier Codearena schema.
alter table public.problems add column if not exists category text not null default 'General';
alter table public.problems add column if not exists input_format text not null default '';
alter table public.problems add column if not exists output_format text not null default '';
alter table public.problems add column if not exists time_limit integer not null default 2000;
alter table public.problems add column if not exists memory_limit integer not null default 128;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.problems'::regclass and conname = 'problems_time_limit_check'
  ) then
    alter table public.problems
      add constraint problems_time_limit_check check (time_limit between 100 and 10000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.problems'::regclass and conname = 'problems_memory_limit_check'
  ) then
    alter table public.problems
      add constraint problems_memory_limit_check check (memory_limit between 16 and 1024);
  end if;
end
$$;

alter table public.test_cases add column if not exists is_sample boolean not null default false;
alter table public.test_cases add column if not exists position integer not null default 0;
create unique index if not exists test_cases_problem_position_uidx
  on public.test_cases (problem_id, position);

do $$
begin
  if to_regclass('public.hidden_test_cases') is not null then
    execute $migrate$
      insert into public.test_cases (id, problem_id, input, expected_output, is_sample, position)
      select id, problem_id, input, expected_output, false, position
      from public.hidden_test_cases
      on conflict (problem_id, position) do nothing
    $migrate$;
    execute 'revoke all on public.hidden_test_cases from anon, authenticated';
  end if;
end
$$;

alter table public.submissions add column if not exists code text;
alter table public.submissions add column if not exists execution_time numeric;
alter table public.submissions add column if not exists memory_used bigint;
alter table public.submissions add column if not exists passed_tests integer not null default 0;
alter table public.submissions add column if not exists total_tests integer not null default 0;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'submissions' and column_name = 'source_code'
  ) then
    execute 'update public.submissions set code = source_code where code is null';
    execute 'alter table public.submissions alter column source_code drop not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'submissions' and column_name = 'time_ms'
  ) then
    execute 'update public.submissions set execution_time = time_ms where execution_time is null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'submissions' and column_name = 'memory_kb'
  ) then
    execute 'update public.submissions set memory_used = memory_kb::bigint * 1024 where memory_used is null and memory_kb is not null';
  end if;
end
$$;

alter table public.submissions alter column code set not null;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.submissions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.submissions drop constraint %I', constraint_name);
  end loop;
end
$$;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.submissions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%language%'
  loop
    execute format('alter table public.submissions drop constraint %I', constraint_name);
  end loop;
end
$$;

update public.submissions set status = 'Runtime Error' where status = 'Error';

alter table public.submissions
  add constraint submissions_status_check
  check (status in ('Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error'));
alter table public.submissions
  add constraint submissions_language_check
  check (language in ('python', 'javascript', 'cpp', 'java'));

comment on column public.submissions.execution_time is 'Maximum Piston API wall-clock duration for one test case, in milliseconds; not sandbox CPU time.';
comment on column public.submissions.memory_used is 'Peak execution memory in bytes when available; Piston API currently leaves this NULL.';

create index if not exists submissions_user_created_idx
  on public.submissions (user_id, created_at desc);
create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username));
create unique index if not exists profiles_single_admin_uidx
  on public.profiles (role) where role = 'admin';

create table if not exists public.site_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, visit_date)
);

create or replace function public.get_admin_site_metrics()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'totalUsers', (select count(*) from public.profiles),
    'totalVisits', (select count(*) from public.site_visits),
    'uniqueVisitors', (select count(distinct user_id) from public.site_visits)
  );
$$;

revoke all on function public.get_admin_site_metrics() from public, anon, authenticated;
grant execute on function public.get_admin_site_metrics() to service_role;

create or replace function public.get_leaderboard()
returns table (
  rank bigint,
  username text,
  points bigint,
  solved_challenges bigint
)
language sql
security definer
set search_path = ''
as $$
  with solved as (
    select submission.user_id, submission.problem_id, problem.difficulty
    from public.submissions as submission
    join public.problems as problem on problem.id = submission.problem_id
    where submission.status = 'Accepted'
    group by submission.user_id, submission.problem_id, problem.difficulty
  ),
  scores as (
    select
      profile.id,
      profile.username,
      count(solved.problem_id)::bigint as solved_challenges,
      coalesce(sum(case solved.difficulty
        when 'Easy' then 10
        when 'Medium' then 20
        when 'Hard' then 30
        else 0
      end), 0)::bigint as points
    from public.profiles as profile
    left join solved on solved.user_id = profile.id
    group by profile.id, profile.username
  )
  select
    row_number() over (order by scores.points desc, scores.solved_challenges desc, lower(scores.username), scores.id),
    scores.username,
    scores.points,
    scores.solved_challenges
  from scores
  order by scores.points desc, scores.solved_challenges desc, lower(scores.username), scores.id
  limit 100;
$$;

revoke all on function public.get_leaderboard() from public, anon, authenticated;
grant execute on function public.get_leaderboard() to service_role;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  base_username text;
  profile_username text;
begin
  profile_name := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  if char_length(profile_name) < 2 or char_length(profile_name) > 100 then
    raise exception 'Enter a full name between 2 and 100 characters.';
  end if;

  if lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g')) = 'ak' then
    raise exception 'Reserved keyword cannot be used as a username.';
  end if;

  base_username := left(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'), 24);
  if char_length(base_username) < 3 then
    base_username := 'coder_' || substr(new.id::text, 1, 8);
  end if;
  profile_username := base_username;
  if exists (select 1 from public.profiles where lower(username) = lower(profile_username)) then
    profile_username := left(base_username, 24) || '_' || substr(new.id::text, 1, 6);
  end if;

  insert into public.profiles (id, full_name, username, avatar_url)
  values (new.id, profile_name, profile_username, new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.problems enable row level security;
alter table public.test_cases enable row level security;
alter table public.submissions enable row level security;
alter table public.site_visits enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can update their public profile" on public.profiles;
create policy "Users can update their public profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Problems are publicly readable" on public.problems;
create policy "Problems are publicly readable"
  on public.problems for select to anon, authenticated using (true);
drop policy if exists "Only sample test cases are publicly readable" on public.test_cases;
create policy "Only sample test cases are publicly readable"
  on public.test_cases for select to anon, authenticated using (is_sample = true);
drop policy if exists "Users can read their own submissions" on public.submissions;
create policy "Users can read their own submissions"
  on public.submissions for select to authenticated using (auth.uid() = user_id);

revoke all on public.profiles, public.problems, public.test_cases, public.submissions from anon, authenticated;
revoke all on public.site_visits from anon, authenticated;
grant select on public.problems to anon, authenticated;
grant select on public.test_cases to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
grant select on public.submissions to authenticated;
grant usage on schema public to service_role;
grant all on public.profiles, public.problems, public.test_cases, public.submissions to service_role;
grant all on public.site_visits to service_role;
