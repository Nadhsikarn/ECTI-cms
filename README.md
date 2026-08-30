# ECTI CMS

The Strapi backend for the ECTI Association website. It holds every piece of
editable content — news, board members, conferences, membership pages, the
document archive — and serves it as a read-only JSON API to the Next.js front
end in [`ECTI-front`](https://github.com/ectipr/ECTI-front).

Editors never touch this repository. They work in the admin panel; this repo is
the schema, the custom behaviour around it, and the deployment.

---

## How the pieces fit

```
   editor
     │  edits + publishes
     ▼
┌──────────────────┐   webhook: POST /api/revalidate   ┌──────────────────┐
│   ECTI-cms       │ ────────────────────────────────► │   ECTI-front     │
│   Strapi 5       │                                   │   Next.js        │
│   Strapi Cloud   │ ◄──────────────────────────────── │   Vercel         │
└──────────────────┘        GET /api/*  (server-side)  └──────────────────┘
         │                                                      ▲
         │ uploads served from a *separate* host                 │
         └──────► <project>.media.strapiapp.com ─────────────────┘
```

The front caches CMS responses for 24 hours and relies on the webhook for
freshness. If the webhook stops arriving, content goes stale for up to a day
rather than breaking — see [Troubleshooting](#troubleshooting).

| | Where |
|---|---|
| Repository | `ectipr/ECTI-cms` |
| Hosting | Strapi Cloud, project `ecti-cms`, **Starter** plan (paid monthly) |
| API base | `https://romantic-harmony-1aed7441dd.strapiapp.com` |
| Admin | `https://romantic-harmony-1aed7441dd.strapiapp.com/admin` |
| Uploads | `https://romantic-harmony-1aed7441dd.media.strapiapp.com` |
| Front end | `ectipr/ECTI-front` on Vercel |

---

## Running it locally

**Requirements:** Node 20 (`engines` pins it), pnpm 10, and PostgreSQL. SQLite
also works if you would rather not run a database — set `DATABASE_CLIENT=sqlite`
and `DATABASE_FILENAME=.tmp/data.db` instead of filling in the Postgres block.

```bash
pnpm install
cp .env.example .env      # then fill it in — see Environment variables
pnpm develop              # http://localhost:1337/admin
```

The first run creates the admin user through the sign-up form. It also grants
public read permissions automatically (see [What this project adds](#what-this-project-adds-to-a-stock-strapi)),
so the API answers straight away without clicking through Settings → Roles.

A local database starts empty. To work against real content, pull it down from
Strapi Cloud — see [Moving content between environments](#moving-content-between-environments).

---

## Environment variables

Copy `.env.example` and fill it in. On Strapi Cloud the same values live under
**Project → Settings → Variables**, and a change there needs a redeploy to take
effect.

### Required

| Variable | What it is |
|---|---|
| `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY` | Strapi's own secrets. Strapi Cloud generates these for you; locally, any long random strings will do. |
| `DATABASE_CLIENT` | `postgres` or `sqlite`. |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` | Postgres connection. Ignored when the client is sqlite. |
| `DATABASE_FILENAME` | SQLite path. Ignored when the client is postgres. |

### Production

| Variable | What it is |
|---|---|
| `CORS_ORIGINS` | Comma-separated origins allowed to call the API from a browser. **Unset means `*`**, which is fine for a dev machine and too loose for production. |
| `WEBHOOK_URL` | The front's revalidation endpoint, e.g. `https://<site>/api/revalidate`. Unset means the front is never told about a publish, and its cache only expires on the 24-hour timer. |
| `WEBHOOK_SECRET` | Shared secret. **Must match `WEBHOOK_SECRET` on the front exactly** or the front answers 401 and revalidation fails silently. |

### Newsletter — optional, off by default

| Variable | What it is |
|---|---|
| `NEWSLETTER_ENABLED` | Must be the exact string `true`. Anything else and publishing a news post only logs what it *would* have sent. |
| `BREVO_API_KEY`, `BREVO_LIST_ID` | Brevo account and target list. |
| `NEWSLETTER_SENDER_EMAIL`, `NEWSLETTER_SENDER_NAME` | Sender identity. The address has to be verified in Brevo. |
| `PUBLIC_SITE_URL` | Used to build article links inside the campaign. Defaults to `https://ecti-thailand.org`. |

Leaving `NEWSLETTER_ENABLED` unset is the safe default, and it is what production
runs today. Turning it on only ever creates a **draft** campaign in Brevo — a
human still has to press send there.

---

## What this project adds to a stock Strapi

All of it lives in `src/index.ts`. Four behaviours, none of them visible in the
admin panel, so they are easy to be surprised by:

**1. Public read permissions, granted at boot** (`enablePublicPermissions`)
Every public content type gets `find` and `findOne` on the public role
automatically. This is why a fresh database serves the API immediately. If you
add a content type the front needs to read, **add its UID to the `publicApis`
array** or it will 404 in production while working fine for a logged-in admin.

**2. Revalidation webhook** (`strapi.documents.use`, first middleware)
Any create/update/delete/publish/unpublish POSTs to `WEBHOOK_URL` signed with
`WEBHOOK_SECRET`, so the front drops its cache for the affected pages. Failures
are swallowed on purpose — a broken front should not stop an editor from saving.
Boot-time warnings tell you when either variable is missing.

**3. Newsletter broadcast on publish** (`startNewsletterWorker`, `src/newsletter.ts`)
Publishing a news post queues a Brevo draft campaign. Gated behind
`NEWSLETTER_ENABLED` as described above.

**4. `Journal.published_date` auto-stamp**
Publishing a journal entry writes the current time into `published_date` on the
draft first, so both the draft and the published version show it in the admin.

---

## Deploying

Strapi Cloud builds from `main`. **Pushing to `main` deploys.** There is no
separate release step.

You can also start a build by hand from the Cloud dashboard under
**Deployments → Trigger deployment**, which is what you want after changing an
environment variable, since variables are read at boot rather than at push time.

If the GitHub repository ever moves to a different owner, the connection is
repaired in **Project → Settings → General → Connected git repository →
Update repository**. The Cloud project itself does not have to be recreated.

> ⚠️ **Never delete the Cloud project.** Strapi Cloud bills per project, so
> deleting it cancels the paid subscription immediately and takes the database
> and uploads with it.

---

## Moving content between environments

Content lives in the database, not in this repository, so it travels with
`strapi transfer` rather than with git.

```bash
# local  ->  cloud   (overwrites the cloud)
pnpm strapi transfer --to https://<project>.strapiapp.com/admin --to-token <token>

# cloud  ->  local   (overwrites your machine)
pnpm strapi transfer --from https://<project>.strapiapp.com/admin --from-token <token>
```

Create the token in the **destination**'s admin under
**Settings → Transfer Tokens** — type **Push** for `--to`, **Pull** for `--from`.
It is shown once. Delete it when you are done; it can wipe a database.

Three things to know before running it:

- **It deletes everything at the destination first.** This is a replace, not a
  merge. Back up first: `pg_dump` locally, or the **Backups** tab on Cloud.
- **Both sides must run the exact same Strapi version.** After pulling a commit
  that bumps Strapi, run `pnpm install` before transferring, or the CLI aborts
  with a version-mismatch error naming the version your `node_modules` actually
  has — which is the useful clue.
- **Stop your local Strapi first.** The CLI boots its own instance.

Admin accounts travel with the data, so after pushing local → cloud you may find
yourself logging into Cloud with your *local* admin password.

---

## Importing the old WordPress content

One-off scrapers and importers for the legacy ecti-thailand.org archive live in
`scripts/`, with their own documentation: **[`scripts/README.md`](scripts/README.md)**.

They are safe to re-run — both importers skip anything already present, matched
on `slug`.

---

## Troubleshooting

**A deploy fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`**
pnpm refuses packages published less than 24 hours ago, as a supply-chain guard.
Nothing is wrong with the code. **Wait until the named packages are a day old and
redeploy** — the cutoff is a rolling window. Do not weaken the policy to get past
it.

**Content changes do not appear on the site**
Check in this order:

1. Does the API show the change? `curl https://<project>.strapiapp.com/api/news-posts`
2. Is `WEBHOOK_URL` set on Cloud, and pointing at the current front URL?
3. Does `WEBHOOK_SECRET` match the front's exactly? A mismatch returns 401 and is
   completely silent from the editor's side.

Without the webhook the front still catches up within 24 hours on its own.

**Images are missing on the front, but text is fine**
Strapi Cloud serves uploads from `<project>.media.strapiapp.com`, a different host
from the API. The front's Content-Security-Policy has to allow both. This is
handled in `ECTI-front`'s `next.config.mjs`; the symptom of getting it wrong is
alt text everywhere and CSP violations in the browser console.

**A new content type returns 404 in production**
Its UID is missing from `publicApis` in `src/index.ts`. See
[What this project adds](#what-this-project-adds-to-a-stock-strapi).

---

## Handover notes

- The Strapi Cloud account, the GitHub account (`ectipr`) and the Vercel account
  are all owned by the association's shared email, not by an individual.
- The Cloud subscription is **monthly and needs a payment method that keeps
  working**. If it lapses the project is suspended: deploys stop and the API goes
  down. Content is not lost while suspended, but it is not reachable either.
- Transfer tokens and API tokens should be deleted once the task that needed them
  is finished. They are database keys, not logins.
