# scripts

Moving content off the old WordPress site (ecti-thailand.org) into this CMS.
Two archives, one script pair each, and the same shape both times: a scrape
step that only reads the old site and writes a file, and an import step that
only reads that file and writes to Strapi. Splitting them means the slow,
failure-prone half can be re-run without going back to a WordPress install that
is on its way out.

Both imports skip anything already in the CMS, matched on `slug` — the one field
that is neither localised nor edited in the admin — so a run that fails halfway
can simply be run again.

Both fill the `th` and `en` locales with the same text. Nothing in either archive
is translated, and putting each entry in only the locale it happens to be written
in would hide most of it from whichever language a reader picked.

## Importing the legacy news archive

Moves the 60 posts on the old WordPress site (ecti-thailand.org) into this CMS.
Two steps, deliberately separate: the first only reads the old site and writes a
file, the second only reads that file and writes to Strapi. Splitting them means
the slow, failure-prone half can be re-run without going back to a WordPress
install that is on its way out.

```bash
# 1. Read the old site into scripts/data/legacy-news.json
pnpm news:scrape

# 2. See what would be created, without writing anything
STRAPI_URL=... STRAPI_API_TOKEN=... pnpm news:import --dry-run

# 3. Do it
STRAPI_URL=... STRAPI_API_TOKEN=... pnpm news:import
```

`legacy-news.json` is committed. The old site is the only source for this
content, and once it is switched off the file is the archive.

### What the import does

- **Skips anything already there.** Matching is on `slug`, the one field that is
  neither localised nor edited in the admin. A post that exists is left alone,
  including edits made to it since an earlier run — so a run that fails halfway
  can simply be run again.
- **Creates drafts.** Sixty posts appearing on the live site the moment a script
  finishes should not be something that happens by accident, and the HTML
  conversion is worth a look before it is public.
- **Fills both locales with the same text.** The archive is 47 English posts and
  13 Thai ones and none of them have a translation; putting each in only the
  locale it happens to be written in would hide four out of five posts from
  whichever language a reader picked.
- **Copies the images into Strapi.** Cover images and the ones inside posts both
  end up in the media library, so nothing keeps pointing at a WordPress install
  whose only remaining job is serving those files.

### Getting a token

Strapi admin → Settings → API Tokens → Create new API Token, type **Full
access**. The token is shown once. It needs write access to news-post, tag and
upload.

### Things it cannot do

- **Four posts get an id-based slug** (`legacy-15474` and similar). WordPress
  stores a percent-encoded Thai slug for Thai titles, which Strapi's uid field
  rejects. Rename them in the admin if you want something readable — do it after
  the import, since the skip check matches on the slug.
- **Three posts arrive with an empty body.** They have no body on the old site
  either; the poster image is the whole post.
- **Tags are guessed from the title.** Every post on the old site carries the
  same four WordPress tags and the category "News", so there was nothing to map.
  The guess is right often enough to be worth having and wrong often enough to
  check.
- **One image is gone.** A 2018 upload that 404s on both the old subdomain and
  the current one. The import names it in the summary and leaves it out.

## Importing the legacy conference list

The old site's [Conference & Activities](https://ecti-thailand.org/conference-activities/)
page — one table of 39 past conferences plus two countdown widgets — becomes
entries in **Activity**, which is what the `/events` page reads.

```bash
pnpm conf:scrape
STRAPI_URL=... STRAPI_API_TOKEN=... pnpm conf:import --dry-run
STRAPI_URL=... STRAPI_API_TOKEN=... pnpm conf:import
```

41 conferences, 2004 to 2025. The token needs write access to activity.

### ⚠️ These are not drafts

`api::activity.activity` has `draftAndPublish` turned off (issue #33 — it is
waiting on a paid Strapi Cloud plan), so **every entry is live the moment it is
created**. There is no unpublished state to review them in.

So: `--dry-run` first, then `--limit 2`, and look at `/events` under the "Past"
filter before running the rest. Undoing a full run means deleting 41 entries by
hand.

### How the mapping works

| Activity field | Where it comes from |
|---|---|
| `title` | the bold short name — `ECTI-CON 2016` |
| `description` | the full conference name underneath it |
| `slug` | the short name, with the year split off — `ecti-con-2016` |
| `event_start_date` / `event_end_date` | the `Date : 4-7 July 2018` line |
| `year` | the year in that date |
| `type` | always `conference` |
| `event_status` | **computed from the date, not from the old page** |
| `register_url` | the website button |
| `location` | left empty — the old page never recorded it |

`event_status` is worth explaining. The old page has an "Upcoming Conferences"
heading above two countdown widgets whose timers ran out in 2024 and 2025 —
nobody updated them. Trusting the heading would import two finished conferences
as upcoming ones, so the status is decided by comparing the date to today.

### Things it cannot do

- **11 conferences have no website link.** The old page has no button for them
  either; those conference sites are long gone.
- **No location for any of them.** It is not on the old page.
- **No cover images.** The page is a table of text.
