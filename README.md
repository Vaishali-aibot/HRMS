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
  reporting-manager picked from a real employee list rather than free text)

Everything else in the PRD (onboarding workflow, documents, attendance,
leave, performance, recognition, exits, reports, etc.) is **not built yet**
— see [Roadmap](#roadmap-remaining-prd-modules) below for a suggested build
order.

## Project structure

```
src/
  app/
    sign-in/page.tsx              Microsoft SSO sign-in page
    dashboard/layout.tsx          Authenticated shell (nav, sign-out)
    dashboard/page.tsx            HR metrics dashboard (PRD §6)
    dashboard/employees/page.tsx  Employee Master list (PRD §7)
    dashboard/employees/new/      Add-employee form
    api/auth/[...nextauth]/       Auth.js route handler
  lib/
    auth.ts                       Auth.js config (Entra ID provider, RBAC session)
    prisma.ts                     Prisma Client singleton (driver adapter)
    rbac.ts                       requireRole()/requireRoleForPage()/requireSession() guards
    safe-redirect.ts              Open-redirect guard for callbackUrl-style params
    actions/employee.ts           Server Action: create employee (transactional)
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
`Role` default in `prisma/schema.prisma`). Promote yourself manually the
first time:

```bash
npm run db:studio
# open the User table, sign in once first so your row exists, set role = HR_ADMIN
```

(A proper "invite/assign role" HR Admin screen is a good next build item —
see roadmap.)

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
- `AuditLog` (PRD §31) exists as a table only — nothing writes to it yet,
  since there's no edit/update mutation for it to log. Wire it up when the
  first "edit employee" action is built.
- The `Counter` model (used for atomic, race-free `employeeCode` generation)
  was added after the initial scaffold. If you already ran a migration
  before pulling this change, run `npm run db:migrate` again to pick it up.

## Roadmap: remaining PRD modules

Suggested build order, grouped roughly by the PRD's own priority framework
(§43):

**Next (P0 remainder):**
1. Role assignment screen (HR Admin invites/promotes users) — currently
   manual via Prisma Studio.
2. Employee detail/edit page + status-change action (drives §8 lifecycle
   + §31 audit log you already have tables for).
3. Onboarding workflow (§10–§11): document checklist, document upload
   (Vercel Blob), IT checklist, automated reminder cron (Vercel Cron).
4. Attendance + Leave modules (§13–§15): leave types/balances, apply/approve
   flow, WFH requests.
5. Probation tracking automation (§16): scheduled job flips status and
   notifies HR/manager at 30/15/7 days.
6. Exit/separation workflow (§24–§26): resignation → checklist → asset
   return → clearance.
7. HR Helpdesk (§21): request categories, SLA dashboard.

**Later (P1):** performance cycles + PIP (§17–§18), recognition (§19),
asset management (§26), integrations (§32) — Outlook/Teams notifications,
e-signature.

**Phase 3 (P2):** AI assistant / natural-language HR queries (§40) — a
good fit for Claude once the data model above is populated.

For each new module, follow the same pattern already in this codebase:
a Prisma model, a `requireRole()`-guarded Server Action, and a page under
`src/app/dashboard/`.
