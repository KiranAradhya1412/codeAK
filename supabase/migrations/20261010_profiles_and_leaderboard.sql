begin;

alter table public.profiles
  add column if not exists full_name text not null default '';

update public.profiles
set full_name = username
where btrim(full_name) = '';

alter table public.profiles
  drop constraint if exists profiles_full_name_check;

alter table public.profiles
  add constraint profiles_full_name_check
  check (char_length(btrim(full_name)) between 2 and 100);

alter table public.profiles
  drop constraint if exists profiles_username_check;
alter table public.profiles
  drop constraint if exists profiles_username_format_check;
alter table public.profiles
  add constraint profiles_username_format_check
  check (
    username ~ '^[a-zA-Z0-9_]{3,32}$'
    or (lower(username) = 'ak' and role = 'admin')
  );

create unique index if not exists profiles_single_admin_uidx
  on public.profiles (role)
  where role = 'admin';

create table if not exists public.site_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, visit_date)
);

alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
grant all on public.site_visits to service_role;

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

commit;
