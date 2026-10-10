-- Replace the example address with the email of an existing Supabase Auth user.
-- Run this once in the Supabase SQL Editor as the project owner.
update public.profiles as profile
set username = 'AK',
    role = 'admin'
from auth.users as auth_user
where auth_user.id = profile.id
  and lower(auth_user.email) = lower('REPLACE_WITH_YOUR_AUTH_EMAIL')
returning profile.id, profile.username, profile.role;
