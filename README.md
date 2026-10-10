# codeAK

A coding-practice platform built with Next.js App Router, React, Tailwind CSS, Monaco Editor, Express, Supabase Auth/PostgreSQL, and Judge0 CE.

## Phase 1: Supabase database and authentication

- `supabase/schema.sql` creates profiles linked to `auth.users`, problems, sample and hidden test cases, and submissions.
- RLS is enabled on every application table. Anonymous and signed-in clients can read public problems and rows in `test_cases` only when `is_sample = true`.
- There is no client policy for hidden test cases. The API uses the service-role key to load test input and expected output; that key must only exist in the API environment.
- A database trigger creates each user's profile on signup. Users can read their own profile and update their username/avatar, but cannot update the role.

Run `supabase/schema.sql` first and `supabase/seed.sql` second in the Supabase SQL Editor. The schema includes a migration from the earlier Codearena `hidden_test_cases` and submission-column names.

## Phase 2: Express API and Judge0 CE execution

`apps/api/src/index.ts` contains the authenticated Express routes; `apps/api/src/judge.ts` owns the Judge0 request, output normalization support, resource limits, and execution status mapping.

- `GET /api/problems` lists problem fields for authenticated users.
- `GET /api/problems/:slug` returns one problem and its sample cases only, for authenticated users.
- `GET /api/submissions/status` returns solved problem IDs for the authenticated user.
- `POST /api/submissions` accepts `{ problemId, code, language, mode }`, where `mode` is `sample` or `submit`. JWTs are verified with Supabase Auth. Sample runs only load sample rows; submissions only load hidden rows.
- `GET /api/leaderboard` returns the top 100 codenames with unique solved-challenge counts and points. Accepted challenges award 10 points for Easy, 20 for Medium, and 30 for Hard; each problem counts once per user.
- `GET /api/admin/dashboard` returns paginated account email/profile metadata and aggregate visit counts only to the single profile assigned the `admin` role. `POST /api/visits` records at most one visit per authenticated account per UTC day; no IP addresses are stored.
- Submitted code is passed to the managed Judge0 CE API using server-side RapidAPI credentials; it is never executed in the Express process. Network access is disabled for each submitted program. Test output is whitespace-normalized for comparison. Only aggregate verdict/counts are returned for hidden tests.
- Each account is limited to 10 executions per minute. Source length, request body size, execution time, memory, and test count are bounded.

Judge0 reports per-execution memory usage, which the API persists in bytes and the UI displays. Wall time is the API-observed Judge0 request duration, not the sandbox CPU time. The managed service enforces its account plan and request quotas; keep the RapidAPI key only in server-side secrets.

## Phase 3: Next.js workspace

`apps/web/src/app/page.tsx` provides the searchable, difficulty-filtered problem list and per-user solved badges. `apps/web/src/app/problems/[slug]/page.tsx` provides the resizable problem/editor split, four-language Monaco editor, sample runner, hidden-test submit action, and output console. Email/password sign-in and registration are in `apps/web/src/app/auth/page.tsx`. An app-wide gate hides challenge pages and redirects signed-out visitors to sign-in, returning them to their requested page after authentication. The site uses a light theme.

The current seed set contains original practice challenges. Do not copy proprietary challenge statements or wholesale catalogs from third-party platforms; expand the collection with original content or datasets whose licenses explicitly allow redistribution.

## Accounts and leaderboard

Sign-up asks for a full name and a unique public codename. The full name is private account profile data and is not included in the leaderboard; leaderboard entries display the codename, unique solved count, and points. Accepted solutions score once per challenge: Easy is 10 points, Medium is 20, and Hard is 30.

Apply `supabase/schema.sql`, then create/confirm the administrator's account through Supabase Auth. Replace the example email in `supabase/bootstrap-admin.sql` with that existing account's email and run the statement in the Supabase SQL Editor. It assigns the reserved `AK` profile name and administrator role; the database permits only one administrator. Do not put administrator passwords in SQL, source files, or browser code. Supabase Auth stores password hashes and does not expose recoverable passwords; use Supabase's password reset flow if credentials need changing. The admin screen is not linked from the public navigation, and its API verifies the database role for every request.

## Phase 4: Seed data and checks

`supabase/seed.sql` inserts Two Sum, Valid Palindrome, and Reverse String, with Python, JavaScript, Java, and C++ starter code plus sample and hidden cases. The API includes focused Judge0 adapter tests in `apps/api/src/judge.test.ts`.

```powershell
npm install
npm run test --workspace @codeak/api
npm run build
```

## Local setup

Requirements: Node.js 20.9+, npm, and a Supabase project.

1. Run the schema and seed SQL as described above.
2. Copy `apps/web/.env.example` to `apps/web/.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Copy `apps/api/.env.example` to `apps/api/.env`. Set `SUPABASE_URL`, the **service-role** `SUPABASE_SERVICE_ROLE_KEY`, and the server-side `JUDGE0_API_KEY` from your Judge0 CE RapidAPI subscription. Never put these keys in a `NEXT_PUBLIC_*` variable.
4. From the repository root, run `npm install` and `npm run dev`. The web app runs at `http://localhost:3000`; the API health check is `http://localhost:4000/health`.
5. Create an account and open a problem to run its sample cases or submit against hidden tests. Email confirmation is disabled in the Supabase Auth settings.

Code execution requires a managed Judge0 CE subscription and a valid RapidAPI key. Check its current plan limits and terms before selecting a subscription; the key is not included in the repository.

## Deployment

- **Supabase:** execute the schema and seed SQL, configure Auth email settings, and use the project's URL and anon key in the frontend. Keep the service-role key server-side.
- **Render (API):** the root `render.yaml` is a Blueprint for the Express API. Create a Blueprint from this GitHub repository and provide `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JUDGE0_API_KEY` as secret values when prompted. `JUDGE0_API_URL` defaults to the Judge0 CE RapidAPI endpoint. Render builds from the repository root, starts only the API workspace, and checks `GET /health`. Set `WEB_ORIGIN` to the deployed frontend origin if it changes.
- **Render free-tier behavior:** free web services spin down after 15 minutes without inbound traffic and can take about a minute to start again. The health endpoint is for service health checks; no self-pinging keep-alive job is configured. To keep the API continuously available, change the service to a paid compute plan in Render.
- **Vercel (web):** use `apps/web` as the project root and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_URL` to the deployed API origin.

Obtain the current Judge0 CE RapidAPI plan and key from [Judge0 CE on RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce), then set `JUDGE0_API_KEY` in Render's secret environment variables before expecting code execution to work.
