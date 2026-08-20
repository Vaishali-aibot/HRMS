# HRMS

Human Resource Management System for dotkonnekt, built per the internal PRD (v1.0).
Deploys to **Vercel**; auth is **Microsoft Entra ID (Azure AD) SSO** against the
`dotkonnekt.com` tenant.

> ⚠️ **Bleeding-edge stack.** This project was scaffolded on Next.js 16.3.1
> (Turbopack, the new `proxy.ts` convention, async route params) and Prisma
> 7.9.1 (driver-adapter-only client, no `datasource.url` in schema.prisma).
> Both shipped very recently. If you ask an AI assistant for help later,
> point it at `AGENTS.md` / `node_modules/next/dist/docs` and this README
> first — general Next.js/Prisma knowledge from training data is likely to
> suggest older, now-invalid APIs (e.g. `middleware.ts`, `prisma-client-js`
> generator, schema-level `url`).

## What's built (MVP slice)

- Project scaffold: Next.js 16 (App Router, TypeScript, Tailwind v4)
- Prisma schema: Auth.js tables + **Employee Master** (PRD §7) + **lifecycle
  status history** (PRD §8) + a generic **audit log** table (PRD §31)
- Auth: Microsoft Entra ID SSO via Auth.js v5, database-backed sessions
- RBAC: `Role` enum (`HR_ADMIN`, `HR_EXECUTIVE`, `MANAGER`, `EMPLOYEE`,
  `MANAGEMENT`); `requireRole()`/`requireSession()` guard every Server Action,
  `requireRoleForPage()` gates HR-only pages (redirects rather than crashing),
  route protection in `src/proxy.ts`
- Pages: sign-in (open-redirect-safe `callbackUrl` handling), HR dashboard
  (headcount/probation/notice-period counts, HR/management-only), employee
  list (HR/management-only), add-employee form (employee + lifecycle-history
  write in one atomic transaction, race-free sequential employee codes,
  reporting-manager picked from a real employee list rather than free text),
  employee detail/edit page (field edits write to `AuditLog`, status changes
  write to `EmployeeStatusHistory` with a real `previousStatus` — read-only
  for `MANAGEMENT`, editable for `HR_ADMIN`/`HR_EXECUTIVE`), user access
  screen (`HR_ADMIN`-only role assignment, blocks demoting the last admin),
  onboarding checklists (PRD §10–§11 — one document-status row and one IT
  setup-task row per employee, created automatically the moment the
  employee record exists; a dedicated `/dashboard/onboarding` view lists
  everyone currently pre-boarding/onboarding with checklist progress),
  **leave** (PRD §14 — 3 default leave types seeded automatically, one
  balance per employee per year created lazily, apply → manager-or-HR
  approve/reject → balance deducted on approval with a re-check to prevent
  overdrawing), **attendance** (PRD §13 — HR marks anyone's status directly;
  a manager can mark their own direct reports' (checked in the action, not
  just implied by the UI); everyone gets same-day self-check-in for their
  own record plus a monthly summary; every override/self-mark writes an
  `AuditLog` entry; employees can also submit **correction requests** for a
  *past* date → their manager or HR approves/rejects → an approval applies
  the correction and audit-logs it, same as a direct override), **document
  upload** (PRD §10 — employees
  upload their own onboarding documents to Vercel Blob as **private**
  objects — PAN/Aadhaar/bank proof are never a public URL — served back
  only through an authenticated route to the document's own employee or
  HR; uploading resets status to `SUBMITTED` for re-review, and a
  re-upload deletes the file it replaced), **automated reminders** (PRD
  §23 — a daily Vercel Cron job emails each onboarding employee their own
  outstanding documents, each manager their team's pending leave requests,
  and every `HR_ADMIN` a daily digest), **probation tracking** (PRD §16 —
  `probationEndDate` is calculated automatically from date of joining + a
  probation period at employee creation (90-day default, overridable); HR
  extends it with a required reason (audit-logged) via a dedicated form
  that only appears while status is `PROBATION`; confirming (via the
  existing status-change form) auto-records `confirmationDate` the first
  time; the reminders cron flags anyone hitting the 30/15/7-day mark today
  — Vercel's Hobby plan runs cron at most once/day, so exact-day matching
  is what makes this fire once per milestone instead of daily)

Not yet built: WFH as its own request workflow (folded into attendance's
`WORK_FROM_HOME` status instead), performance, recognition, exits, reports,
etc. — see [Roadmap](#roadmap-remaining-prd-modules) below for a suggested
build order.

## Project structure

```
src/
  app/
    sign-in/page.tsx              Microsoft SSO sign-in page
    dashboard/layout.tsx          Authenticated shell (nav, sign-out)
    dashboard/page.tsx            HR metrics dashboard (PRD §6)
    dashboard/employees/page.tsx  Employee Master list (PRD §7)
    dashboard/employees/new/      Add-employee form
    dashboard/employees/[id]/     Employee detail/edit page, status-change form,
                                   onboarding document/IT checklist rows (+ upload)
    dashboard/onboarding/page.tsx Onboarding progress overview (PRD §6/§10/§11)
    dashboard/documents/page.tsx  Self-service: upload my own onboarding documents
    dashboard/leave/              Leave: balances, apply form, approve/reject (PRD §14)
    dashboard/attendance/         Attendance: HR/manager marking, self-check-in,
                                   personal summary, correction requests (PRD §13)
    dashboard/users/              HR_ADMIN-only role assignment + employee linking
    api/auth/[...nextauth]/       Auth.js route handler
    api/documents/[documentId]/   Authenticated file download/streaming proxy —
                                   the ONLY way to read an uploaded document
    api/cron/reminders/           Vercel Cron target — see vercel.json
  components/
    documents/upload-document-form.tsx  Shared file-upload form (self-service
                                         page + HR's view on the employee detail page)
  lib/
    auth.ts                       Auth.js config (Entra ID provider, RBAC session)
    prisma.ts                     Prisma Client singleton (driver adapter)
    rbac.ts                       requireRole()/requireRoleForPage()/requireSession()
                                   guards — SERVER-ONLY, see roles.ts
    roles.ts                      Pure role constants/labels — safe to import from
                                   "use client" files (rbac.ts is not — see comment)
    safe-redirect.ts              Open-redirect guard for callbackUrl-style params
    leave-balance.ts              ensureLeaveBalance() — lazy per-year balance creation
    date-only.ts                  Shared UTC-midnight date helpers (todayUTC(), etc.)
    document-upload.ts            Shared upload constraints (size/type) — client + server
    email.ts                      sendEmail() — Resend, logs instead of throwing if unconfigured
    reminders.ts                  Reminder queries + emails, called by the cron route
    actions/employee.ts           Server Action: create employee (transactional,
                                   also seeds onboarding checklists + leave balances)
    actions/employee-detail.ts    Server Actions: update employee (+ AuditLog),
                                   change lifecycle status (+ EmployeeStatusHistory,
                                   auto confirmationDate), extend probation (+ AuditLog)
    actions/onboarding.ts         Server Actions: update document/IT task status,
                                   upload an onboarding document to Vercel Blob
    actions/user-role.ts          Server Actions: change a user's role (+ AuditLog),
                                   link/unlink a user to an employee record
    actions/leave.ts              Server Actions: apply/approve/reject/cancel leave
    actions/attendance.ts         Server Actions: mark attendance (HR any / manager own
                                   reports), self-check-in for today (+ AuditLog)
    actions/attendance-correction.ts  Server Actions: request/approve/reject/cancel
                                       an attendance correction (+ AuditLog on approval)
  proxy.ts                        Route protection (Next 16's renamed "middleware")
  types/next-auth.d.ts            Session type augmentation (adds role, id)
prisma/
  schema.prisma                   Data model
  prisma.config.ts                Prisma 7 config (datasource URL, migrations path)
```

## Local setup

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (see below) —
   `AUTH_MICROSOFT_ENTRA_ID_*` can stay blank until you've done the Azure
   step, but the app won't start sign-in without them.
2. Generate an `AUTH_SECRET`:
   ```bash
   npx auth secret
   ```
3. Get a Postgres database. Fastest path for local dev — a free
   [Neon](https://neon.tech) project, or `npx prisma dev` for a local
   throwaway Postgres. Put the connection string in `DATABASE_URL`.
4. Push the schema and generate the client:
   ```bash
   npm run db:migrate
   ```
5. Run the app:
   ```bash
   npm run dev
   ```

### Document uploads — Vercel Blob

Onboarding document uploads need a Blob store, which needs a token:

1. Locally: run `npx vercel link` once (connects this folder to a Vercel
   project — create one first at [vercel.com/new](https://vercel.com/new)
   if you haven't deployed yet), then `npx vercel env pull .env.development.local`
   to pull `BLOB_READ_WRITE_TOKEN` down automatically once a store exists.
2. If no Blob store exists yet: in the Vercel dashboard → your project →
   **Storage** tab → **Create Database** → **Blob**. Connecting it to the
   project sets `BLOB_READ_WRITE_TOKEN` for you in Vercel's environment
   variables (and `vercel env pull` brings it to your machine).
3. In Vercel's **Project Settings → Environment Variables**, `BLOB_READ_WRITE_TOKEN`
   should already be there once the store is connected — verify it's set
   for Production (and Preview, if you want PR previews to support uploads).

Without this token set, `uploadOnboardingDocument` will fail — the rest of
the app works fine, this only affects document upload specifically.

### Automated reminders — Resend + Vercel Cron

The daily reminders job (`src/app/api/cron/reminders/route.ts`) needs two
things set. Without them, the rest of the app still works — reminders just
get logged to the console instead of emailed (see `src/lib/email.ts`).

1. **Email**: create a free account at [resend.com](https://resend.com),
   verify a sending domain (or use their shared test domain for local dev),
   and create an API key. Set:
   ```
   RESEND_API_KEY=<your API key>
   EMAIL_FROM="HRMS <notifications@yourdomain.com>"
   ```
2. **Cron auth**: generate a random 16+ character string (a password
   generator works fine) and set it as `CRON_SECRET` in both your local
   `.env` and Vercel's environment variables — Vercel automatically sends
   it as `Authorization: Bearer <value>` when it invokes the cron job. The
   route refuses every request if this isn't set, so don't skip it in
   Vercel even though the job doesn't run locally (`vercel dev`/`next dev`
   don't trigger cron jobs — see "Running cron jobs locally" in Vercel's
   docs if you want to test it manually with `curl`).
3. Optional: set `NEXT_PUBLIC_APP_URL` to your real deployed URL so links
   inside reminder emails don't point at `localhost`.

`vercel.json` schedules the job for `0 3 * * *` (3am UTC, once daily) —
Vercel's Hobby plan only allows once-per-day cron jobs, so this is the
right default even if you're on a paid plan and could go more frequent.

I have not run this against a real Resend account or a real Vercel Cron
invocation — verified against `resend`'s and Vercel's actual documented
APIs, but genuinely untested end-to-end in this environment. Send yourself
a test reminder (`curl` the route with the right `Authorization` header)
before trusting it in production.

### Creating the first HR Admin

Everyone who signs in gets created as `EMPLOYEE` by default (see
`Role` default in `prisma/schema.prisma`). The in-app `/dashboard/users`
screen (HR_ADMIN-only) can't help with the *first* admin — nobody has that
role yet — so bootstrap it once via Prisma Studio:

```bash
npm run db:studio
# open the User table, sign in once first so your row exists, set role = HR_ADMIN
```

After that, use `/dashboard/users` in the app for every subsequent role
change.

## Auth setup — Microsoft Entra ID (Azure AD)

You (an admin on the dotkonnekt.com Microsoft 365 tenant) need to register
an app. This is a console step only you can do — I can't do it for you.

1. Go to [Microsoft Entra admin center](https://entra.microsoft.com) →
   **App registrations** → **New registration**.
2. Name it (e.g. "HRMS"). Under **Supported account types**, choose
   "Accounts in this organizational directory only" (single tenant) unless
   you have a reason to allow guests.
3. **Redirect URI**: platform = Web.
   - Local dev: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - Production: `https://<your-vercel-domain>/api/auth/callback/microsoft-entra-id`
   You'll add the production one after your first Vercel deploy gives you a
   domain — you can edit redirect URIs later.
4. After creation, note the **Application (client) ID** and **Directory
   (tenant) ID** from the Overview page.
5. **Certificates & secrets** → **New client secret** → copy the *value*
   immediately (it's hidden after you leave the page).
6. Set env vars (locally in `.env`, in Vercel as Project Environment
   Variables):
   ```
   AUTH_MICROSOFT_ENTRA_ID_ID=<Application (client) ID>
   AUTH_MICROSOFT_ENTRA_ID_SECRET=<client secret value>
   AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<Directory (tenant) ID>/v2.0/
   ```
   Setting `ISSUER` to your tenant restricts sign-in to dotkonnekt.com
   accounts only — don't skip it, or any Microsoft account could sign in.

I have not verified this against the current Entra admin center UI (it
changes screen layouts periodically) — if a menu is in a different place,
Microsoft's own quickstart is the source of truth:
https://learn.microsoft.com/entra/identity-platform/quickstart-register-app

## Deploying to Vercel

1. Push this repo to GitHub (see commands below).
2. In the [Vercel dashboard](https://vercel.com/new), import the repo.
3. Add a Postgres database: Vercel project → **Storage** tab → **Create
   Database** → Postgres (Neon-backed) — or bring your own (Neon,
   Supabase, RDS, etc.). Copy the pooled connection string.
4. In **Project Settings → Environment Variables**, add for Production
   (and Preview if you want PR previews to work):
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `AUTH_MICROSOFT_ENTRA_ID_ID`
   - `AUTH_MICROSOFT_ENTRA_ID_SECRET`
   - `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
   - `BLOB_READ_WRITE_TOKEN` (see "Document uploads — Vercel Blob" above —
     set automatically once you connect a Blob store to the project)
   - `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` (see "Automated
     reminders — Resend + Vercel Cron" above)
   - `NEXT_PUBLIC_APP_URL` (optional — your production URL, used for links
     inside reminder emails)
5. Deploy. `postinstall` runs `prisma generate` automatically during the
   Vercel build — you don't need to configure that.
6. Run the migration against the production database once, from your
   machine (or a Vercel deploy hook / CI step):
   ```bash
   DATABASE_URL="<production connection string>" npm run db:deploy
   ```
7. Go back to your Entra app registration and add the production redirect
   URI (step 3 in the Azure section above), using your real
   `*.vercel.app` domain or custom domain.

I'm not fully certain of Vercel's current exact UI labels/flow (dashboards
change over time) — the sequence above is the one that's been stable for a
long while; if a button is named differently, Vercel's own docs
(vercel.com/docs) are the source of truth.

## Push to GitHub

```bash
git init
git add -A
git commit -m "Initial HRMS scaffold: employee master, Entra ID auth, RBAC"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

## Known items to revisit

- `npm audit` currently flags a **high severity** transitive advisory in
  `deepmerge-ts` (pulled in by `@prisma/config`) — every current Prisma 7.x
  release is affected; the only fix `npm audit fix --force` offers is a
  downgrade to Prisma 6.12.0, which would break the driver-adapter setup
  this scaffold relies on. It's a build-tooling dependency, not something
  shipped to your production runtime, but re-check `npm audit` after your
  next `npm update` and swap to a patched Prisma version once one exists.
- `@auth/prisma-adapter`'s TypeScript types are written against the default
  `@prisma/client` import path; since Prisma 7 generates the client to a
  custom `src/generated/prisma` folder, `src/lib/auth.ts` casts the client
  to satisfy the type checker. It compiles and type-checks cleanly today
  (verified), but re-check this cast if you upgrade either package.
- Compensation/bank/statutory fields (PRD §7) exist in the schema but have
  no UI yet — deliberately, since they need tighter field-level RBAC than
  this scaffold implements. Build that as its own module (see roadmap).
- The reporting-manager picker only blocks the immediate cycle (an employee
  can't be their own manager). It doesn't check deeper cycles (A → B → A).
  Fine for a small, HR-curated org chart; revisit if this ever needs to
  scale unsupervised.
- The `Counter` model (used for atomic, race-free `employeeCode` generation)
  and the onboarding checklist models (`OnboardingDocument`,
  `ITOnboardingTask`) were added after the initial scaffold. If you already
  ran a migration before pulling one of these changes, run
  `npm run db:migrate` again to pick it up.
- **Client/server module boundary**: `src/lib/rbac.ts` imports `auth.ts` →
  `prisma.ts` → the `pg` driver, which needs Node built-ins (`tls`, etc.)
  that don't exist in the browser. A `"use client"` file that imports
  *anything* from `rbac.ts` — even a pure constant re-exported from it —
  pulls that whole chain into the client bundle and the build fails with
  `Module not found: Can't resolve 'tls'`. This actually happened once
  while building the role-assignment screen. Pure, client-safe role
  constants/labels live in `src/lib/roles.ts` instead — import from there,
  never from `rbac.ts`, in any Client Component.
- **Reminders have no backoff or dedup** — the cron job re-sends to
  anything still outstanding on every run (daily), so a document pending a
  week gets ~7 emails, not one. Also not deduped against duplicate cron
  invocations (Vercel's own docs note cron delivery can double-fire) — a
  double-send in one day is a mild annoyance for a reminder email, not
  something worth a distributed lock over at this stage.
- **Reminders only reach people with a resolvable email**: an employee
  reminder needs either a linked `User` (SSO email) or `personalEmail` set;
  a manager reminder needs the manager to have a linked `User` too. Anyone
  missing both is silently skipped — counted in the route's JSON response
  (`skippedNoEmail`/`skippedNoManagerEmail`) but not surfaced anywhere in
  the UI yet.
- I have not run the reminders job against a real Resend account or a real
  Vercel Cron invocation — verified against the actual `resend` package
  types and Vercel's current documented cron-auth pattern, but genuinely
  untested end-to-end (no API key/cron infra in this environment).
- **Document upload uses Vercel Blob's `private` access mode** (files
  require our own authenticated route to read, not a bare public URL —
  appropriate given these can be PAN/Aadhaar/bank proof). I verified this
  design against `@vercel/blob`'s actual installed type definitions (the
  `access: 'private'` option and its `get()`/`put()` signatures), but I
  have **not** exercised it against a real Blob store — there's no
  `BLOB_READ_WRITE_TOKEN` in this environment to test with. Upload a real
  document and confirm the download link works before relying on this in
  production.
- Re-uploading a document deletes the blob it replaced (best-effort — a
  failed delete is logged but doesn't fail the upload). There's no
  versioning/history of previously-uploaded files, and no way to delete a
  document without replacing it.
- **Leave has no carry-forward, accrual, or encashment** (all in PRD §14) —
  every `LeaveBalance` is a flat per-year allocation at the `LeaveType`'s
  default, created lazily the first time it's needed. A request spanning a
  year boundary (e.g. Dec 30 → Jan 2) is checked/deducted entirely against
  the *start* date's year, not split across both. HR can't add/edit leave
  types via the UI yet — only the 3 seeded defaults exist.
  `applyForLeave`'s balance check is a courtesy, not a reservation (two
  pending requests can both pass it) — `decideLeaveRequest` re-checks
  atomically before deducting, which is what actually prevents overdrawing.
- **Self-check-in is same-day only** — an employee can mark PRESENT/
  WORK_FROM_HOME/HALF_DAY for *today*, and only if HR/their manager hasn't
  already set today's record (checked by comparing `markedById`, not just
  hidden in the UI). Anything else — a past date, ABSENT/LATE/ON_LEAVE,
  overriding an existing HR-set record — goes through
  `requestAttendanceCorrection` instead, deliberately. No external
  attendance-device integration either (PRD §32 frames that as a separate
  integration).
- A correction request snapshots `currentStatus` at submission time but
  `decideAttendanceCorrection` audit-logs the *actual* status at decision
  time (fetched fresh, not the snapshot) — correct, but means the two can
  legitimately differ if the record changed in between (e.g. HR marked it
  directly while the request was pending). Not a bug, just worth knowing
  when reading the audit trail.
- Duplicate/rapid-fire correction requests for the same date are checked
  but not locked — like the leave balance check, it's a courtesy guard
  against a normal double-submit, not a race-proof constraint. Low stakes
  here (worst case is two pending requests for the same date; deciding one
  doesn't auto-resolve the other, so HR/the manager would just see both).
- Self-service (leave/attendance) depends on a User being linked to an
  Employee record via `/dashboard/users` — this is manual (HR_ADMIN picks
  from a dropdown), not automatic. Nothing matches by email; there's no
  "work email" field on Employee to match against the SSO email.
- **Probation has no separate "start date" field** — the schema (and PRD
  §16) treat `dateOfJoining` as the implicit probation start;
  `probationEndDate` is just `dateOfJoining + probationPeriodDays`
  computed once at creation. Existing employees created before this
  feature landed have `probationEndDate = null` until someone extends
  probation or edits the record — the reminders job simply won't flag
  them (no crash, no false positive, just silent until set).

## Roadmap: remaining PRD modules

Suggested build order, grouped roughly by the PRD's own priority framework
(§43):

**Next (P0 remainder):**
1. Leave type management UI (HR can currently only use the 3 seeded
   defaults) and carry-forward/accrual (PRD §14).
2. WFH as its own request workflow (PRD §15) — currently just an attendance
   status value, no separate request/approval flow.
3. Exit/separation workflow (§24–§26): resignation → checklist → asset
   return → clearance.
4. HR Helpdesk (§21): request categories, SLA dashboard.

**Later (P1):** performance cycles + PIP (§17–§18), recognition (§19),
asset management (§26), integrations (§32) — Outlook/Teams notifications,
e-signature.

**Phase 3 (P2):** AI assistant / natural-language HR queries (§40) — a
good fit for Claude once the data model above is populated.

For each new module, follow the same pattern already in this codebase:
a Prisma model, a `requireRole()`-guarded Server Action, and a page under
`src/app/dashboard/`.
