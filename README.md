# codeAK

A coding-practice platform built with Next.js App Router, React, Tailwind CSS, Monaco Editor, Express, Supabase Auth/PostgreSQL, and Piston.

## Phase 1: Supabase database and authentication

- `supabase/schema.sql` creates profiles linked to `auth.users`, problems, sample and hidden test cases, and submissions.
- RLS is enabled on every application table. Anonymous and signed-in clients can read public problems and rows in `test_cases` only when `is_sample = true`.
- There is no client policy for hidden test cases. The API uses the service-role key to load test input and expected output; that key must only exist in the API environment.
- A database trigger creates each user's profile on signup. Users can read their own profile and update their username/avatar, but cannot update the role.

Run `supabase/schema.sql` first and `supabase/seed.sql` second in the Supabase SQL Editor. The schema includes a migration from the earlier Codearena `hidden_test_cases` and submission-column names.

## Phase 2: Express API and Piston judge

`apps/api/src/index.ts` contains the authenticated Express routes; `apps/api/src/judge.ts` owns the Piston request, output normalization support, resource limits, and execution status mapping.

- `GET /api/problems` lists public problem fields.
- `GET /api/problems/:slug` returns one problem and its sample cases only.
- `GET /api/submissions/status` returns solved problem IDs for the authenticated user.
- `POST /api/submissions` accepts `{ problemId, code, language, mode }`, where `mode` is `sample` or `submit`. JWTs are verified with Supabase Auth. Sample runs only load sample rows; submissions only load hidden rows.
- Submitted code is passed to `https://emkc.org/api/v2/piston/execute`; it is never executed in the Express process. Test output is whitespace-normalized for comparison. Only aggregate verdict/counts are returned for hidden tests.
- Each account is limited to 10 executions per minute. Source length, request body size, execution time, memory, and test count are bounded.

Piston does not return reliable per-execution memory usage. The API persists `memory_used` as `NULL` and the UI explicitly labels memory as unavailable; wall time is the API-observed Piston request duration, not a sandbox CPU-time measurement. The hosted Piston endpoint currently requires whitelist approval (the unauthenticated public request returns HTTP 401); configure an approved endpoint or self-host Piston before expecting code execution to work.

## Phase 3: Next.js workspace

`apps/web/src/app/page.tsx` provides the searchable, difficulty-filtered problem list and per-user solved badges. `apps/web/src/app/problems/[slug]/page.tsx` provides the resizable problem/editor split, four-language Monaco editor, sample runner, hidden-test submit action, and output console. Email/password sign-in and registration are in `apps/web/src/app/auth/page.tsx`.

## Phase 4: Seed data and checks

`supabase/seed.sql` inserts Two Sum, Valid Palindrome, and Reverse String, with Python, JavaScript, Java, and C++ starter code plus sample and hidden cases. The API includes focused Piston adapter tests in `apps/api/src/judge.test.ts`.

```powershell
npm install
npm run test --workspace @codeak/api
npm run build
```

## Local setup

Requirements: Node.js 20.9+, npm, and a Supabase project.

1. Run the schema and seed SQL as described above.
2. Copy `apps/web/.env.example` to `apps/web/.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Copy `apps/api/.env.example` to `apps/api/.env`. Set `SUPABASE_URL`, the **service-role** `SUPABASE_SERVICE_ROLE_KEY`, and optionally `PISTON_API_URL`. Never put the service-role key in a `NEXT_PUBLIC_*` variable.
4. From the repository root, run `npm install` and `npm run dev`. The web app runs at `http://localhost:3000`; the API health check is `http://localhost:4000/health`.
5. Create an account, verify the email if confirmation is enabled, then open a problem and run its sample cases or submit against hidden tests.

The default Piston endpoint is included for protocol compatibility but is not available to unapproved public callers. For local or production code execution, obtain whitelist approval or configure a self-hosted Piston-compatible API. For a public production launch, use a managed or self-hosted deployment with suitable capacity, quotas, and monitoring.

## Deployment

- **Supabase:** execute the schema and seed SQL, configure Auth email settings, and use the project's URL and anon key in the frontend. Keep the service-role key server-side.
- **Railway (API):** build with `npm run build --workspace @codeak/api`, start with `npm run start --workspace @codeak/api`, and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PISTON_API_URL`, `WEB_ORIGIN`, and `PORT`.
- **Vercel (web):** use `apps/web` as the project root and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_URL` to the deployed API origin.
