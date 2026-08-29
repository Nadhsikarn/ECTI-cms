# scripts

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
