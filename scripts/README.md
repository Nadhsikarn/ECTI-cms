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

# 2. Pull the images onto disk (see below — do this early)
pnpm images:download

# 3. See what would be created, without writing anything
STRAPI_URL=... STRAPI_API_TOKEN=... pnpm news:import --dry-run

# 4. Do it — posts go live immediately
STRAPI_URL=... STRAPI_API_TOKEN=... pnpm news:import

# ...or bring them in unpublished, to review first
STRAPI_URL=... STRAPI_API_TOKEN=... pnpm news:import --draft
```

### The images are the perishable half

`legacy-news.json` stores image *URLs*, not images — 135 KB of text pointing at
36 MB of pictures that live on the old WordPress server and nowhere else. The
text survives in git; without a second step the pictures do not.

`pnpm images:download` fetches all of them into `scripts/data/images/`, which is
committed alongside the JSON. That is what makes the archive an archive: the
import can run next month against a site that has already been switched off.

The import prefers a local copy and only reaches for the network when one is
missing, so a checkout with the images present never touches the old site at
all. Re-running the downloader skips what it already has.

Of the 72 images referenced, **71 are on disk**. The last one — a 2018 upload —
404s on both the old subdomain and the current host; it was already gone before
any of this was written.

### What the import does

- **Skips anything already there.** Matching is on `slug`, the one field that is
  neither localised nor edited in the admin. A post that exists is left alone,
  including edits made to it since an earlier run — so a run that fails halfway
  can simply be run again.
- **Publishes on arrival.** This list said "creates drafts" for a long time and
  it was never true: a plain POST to Strapi 5's content API stamps `publishedAt`,
  so every run has put its posts straight on the live site. Pass `--draft` for
  the behaviour that was described here, which now exists — it adds
  `status=draft` to both the Thai create and the English localisation, so the
  two halves of a document do not end up in different states.
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

## ตรวจว่าแท็กตามไปยัง locale ที่สอง

```bash
pnpm build
node scripts/test-tag-sharing.cjs
```

Tag เป็น content-type ที่ localized ในตัวเอง แท็กหนึ่งตัวจึงมีสองแถวคนละ id
ต่อให้ช่อง `tags` ในข่าวตั้งเป็น non-localized ไว้แล้ว Strapi ก็แชร์ relation
ให้ไม่ได้ `shareTagsAcrossLocales` ใน lifecycles ของ news-post จึงจับคู่ผ่าน
`key` ของ Tag ซึ่ง non-localized แล้วผูกให้เอง

สคริปต์นี้รันกับฐานข้อมูลจริงเพราะรูปร่างของ payload ที่ document service ส่ง
ลงมาให้ lifecycle เป็นสิ่งที่เดาเอาไม่ได้ ครอบห้ากรณี ไทยก่อนแล้วอังกฤษ
อังกฤษก่อนแล้วไทย ติ๊กแท็กเองในภาษาที่สอง แก้ข้อความเฉย ๆ และข่าวที่ไม่มีแท็ก
เลย ข่าวที่สร้างระหว่างทดสอบถูกลบทิ้งทุกครั้งไม่ว่าผลจะผ่านหรือไม่
