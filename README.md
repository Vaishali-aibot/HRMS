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
  overdrawing), **attendance** (PRD §13 — HR marks daily status per
  employee; everyone gets a personal dashboard summary of their own record)

Not yet built: actual document **upload/storage** (the document checklist
tracks status only, no file attached yet — see Known items), WFH as its own
request workflow (folded into attendance's `WORK_FROM_HOME` status instead),
attendance correction requests, performance, recognition, exits, reports,
automated reminders, etc. — see
[Roadmap](#roadmap-remaining-prd-modules) below for a suggested build order.

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
                                   onboarding document/IT checklist rows
    dashboard/onboarding/page.tsx Onboarding progress overview (PRD §6/§10/§11)
    dashboard/leave/              Leave: balances, apply form, approve/reject (PRD §14)
    dashboard/attendance/         Attendance: HR marks status, personal summary (PRD §13)
    dashboard/users/              HR_ADMIN-only role assignment + employee linking
    api/auth/[...nextauth]/       Auth.js route handler
  lib/
    auth.ts                       Auth.js config (Entra ID provider, RBAC session)
    prisma.ts                     Prisma Client singleton (driver adapter)
    rbac.ts                       requireRole()/requireRoleForPage()/requireSession()
                                   guards — SERVER-ONLY, see roles.ts
    roles.ts                      Pure role constants/labels — safe to import from
                                   "use client" files (rbac.ts is not — see comment)
    safe-redirect.ts              Open-redirect guard for callbackUrl-style params
    leave-balance.ts              ensureLeaveBalance() — lazy per-year balance creation
    actions/employee.ts           Server Action: create employee (transactional,
                                   also seeds onboarding checklists + leave balances)
    actions/employee-detail.ts    Server Actions: update employee (+ AuditLog),
                                   change lifecycle status (+ EmployeeStatusHistory)
    actions/onboarding.ts         Server Actions: update document/IT task status
    actions/user-role.ts          Server Actions: change a user's role (+ AuditLog),
                                   link/unlink a user to an employee record
    actions/leave.ts              Server Actions: apply/approve/reject/cancel leave
    actions/attendance.ts         Server Action: mark attendance (HR-only)
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
- Onboarding documents track **status only** — there's no file storage yet
  (see roadmap: Vercel Blob upload), and there's no automated reminder for
  pending documents/IT tasks yet (see roadmap: Vercel Cron).
- **Leave has no carry-forward, accrual, or encashment** (all in PRD §14) —
  every `LeaveBalance` is a flat per-year allocation at the `LeaveType`'s
  default, created lazily the first time it's needed. A request spanning a
  year boundary (e.g. Dec 30 → Jan 2) is checked/deducted entirely against
  the *start* date's year, not split across both. HR can't add/edit leave
  types via the UI yet — only the 3 seeded defaults exist.
  `applyForLeave`'s balance check is a courtesy, not a reservation (two
  pending requests can both pass it) — `decideLeaveRequest` re-checks
  atomically before deducting, which is what actually prevents overdrawing.
- **Attendance is HR-marked only** — no self-service marking, no
  employee-submitted correction-request → manager-approval flow (both in
  PRD §13), and no external attendance-device integration (PRD §32 frames
  that as a separate integration anyway).
- Self-service (leave/attendance) depends on a User being linked to an
  Employee record via `/dashboard/users` — this is manual (HR_ADMIN picks
  from a dropdown), not automatic. Nothing matches by email; there's no
  "work email" field on Employee to match against the SSO email.

## Roadmap: remaining PRD modules

Suggested build order, grouped roughly by the PRD's own priority framework
(§43):

**Next (P0 remainder):**
1. Document upload (Vercel Blob) for the onboarding checklist — statuses
   are already trackable; this adds an actual file behind each
   `OnboardingDocument` row.
2. Automated reminders (Vercel Cron + an email provider like Resend) for
   pending onboarding documents/IT tasks, upcoming probation ends, and
   pending leave requests.
3. Attendance correction requests (employee submits → manager approves →
   HR visibility) and manager/self-service attendance marking — today
   attendance is HR-marked only.
4. Leave type management UI (HR can currently only use the 3 seeded
   defaults) and carry-forward/accrual (PRD §14).
5. WFH as its own request workflow (PRD §15) — currently just an attendance
   status value, no separate request/approval flow.
6. Probation tracking automation (§16): scheduled job flips status and
   notifies HR/manager at 30/15/7 days — can now call the same
   `changeEmployeeStatus` action the detail page uses.
7. Exit/separation workflow (§24–§26): resignation → checklist → asset
   return → clearance.
8. HR Helpdesk (§21): request categories, SLA dashboard.

**Later (P1):** performance cycles + PIP (§17–§18), recognition (§19),
asset management (§26), integrations (§32) — Outlook/Teams notifications,
e-signature.

**Phase 3 (P2):** AI assistant / natural-language HR queries (§40) — a
good fit for Claude once the data model above is populated.

For each new module, follow the same pattern already in this codebase:
a Prisma model, a `requireRole()`-guarded Server Action, and a page under
`src/app/dashboard/`.
