#!/usr/bin/env node
/**
 * Feeds the file scrape-legacy-news.mjs produced into Strapi.
 *
 * Only creates what is missing. A post already in the CMS — matched on slug,
 * which is the one field that is neither localised nor edited by hand — is left
 * exactly as it is, including any edits made to it since a previous run. That
 * makes the script safe to re-run: after a partial import, run it again and it
 * picks up where it stopped.
 *
 * Posts are published on arrival. This file used to claim they came in as
 * drafts and they never did — a plain POST to Strapi 5's content API stamps
 * publishedAt, so every run since the first one has put its posts straight on
 * the live site. Pass --draft for the behaviour that was described here, which
 * now exists.
 *
 *   STRAPI_URL=... STRAPI_API_TOKEN=... node scripts/import-legacy-news.mjs --dry-run
 *   STRAPI_URL=... STRAPI_API_TOKEN=... node scripts/import-legacy-news.mjs
 *   STRAPI_URL=... STRAPI_API_TOKEN=... node scripts/import-legacy-news.mjs --draft
 *
 * The token needs write access to news-post, tag and upload.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { api, existingSlugs, createInBothLocales, requireToken, STRAPI_URL } from "./lib/strapi.mjs";

const DEFAULT_IN = "scripts/data/legacy-news.json";

/**
 * Images downloaded ahead of time by download-legacy-images.mjs.
 *
 * Resolved against this file rather than the working directory, because the
 * import is run from the repo root but the pictures belong to the script.
 * Missing manifest is not an error: it just means nobody ran the downloader,
 * and every image is fetched from the old site the way it always was.
 */
const IMAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "data", "images");
const LOCAL_IMAGES = await readFile(join(IMAGE_DIR, "manifest.json"), "utf8")
  .then(JSON.parse)
  .catch(() => ({}));

/**
 * Where to look for an image whose own URL no longer resolves.
 *
 * Posts from 2018-19 point their inline images at http://www.ecti.ecti-thailand.org,
 * a subdomain that stopped resolving at some move and takes fourteen images with
 * it. The files are still served from the canonical host at the same path, so a
 * failed fetch is retried there before the image is given up on.
 */
const MEDIA_FALLBACK_ORIGIN = (
  process.env.LEGACY_MEDIA_ORIGIN || "https://ecti-thailand.org"
).replace(/\/+$/, "");

function parseArgs(argv) {
  const args = { in: DEFAULT_IN, dryRun: false, limit: 0, draft: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--in") args.in = argv[++i];
    else if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--draft") args.draft = true;
    else if (flag === "--limit") args.limit = Number(argv[++i]);
    else if (flag === "--help" || flag === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

/** documentId of each tag, keyed by its `key` enum, so posts can be related to one. */
async function tagsByKey() {
  const res = await api("/api/tags?locale=th&pagination[pageSize]=100");
  const map = new Map();
  for (const tag of res.data) if (tag.key) map.set(tag.key, tag.documentId);
  return map;
}

/**
 * Copies an image off the old site into Strapi's media library.
 *
 * Pointing at the old URL would have been less code, and would have left the
 * whole archive depending on a WordPress install whose only remaining purpose
 * is to serve those files — the day it is switched off, every imported post
 * loses its images.
 */
async function fetchImage(url) {
  // A copy on disk wins over the network. download-legacy-images.mjs puts one
  // there for every image the archive refers to, which is what lets this run
  // long after the old site is gone — and on a run where it is still up, it
  // saves 36 MB of downloads and any chance of a flaky fetch halfway through.
  const local = LOCAL_IMAGES[url];
  if (local) {
    try {
      return new Response(await readFile(join(IMAGE_DIR, local.file)));
    } catch {
      // Manifest lists it but the file is missing — fall through to the network
      // rather than failing, since the archive may have been checked out
      // without the images.
    }
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (res.ok) return res;
    if (res.status !== 404) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // A dead host throws rather than answering, which is the case this exists
    // for — fall through to the retry.
    if (!MEDIA_FALLBACK_ORIGIN) throw err;
  }

  const retry = `${MEDIA_FALLBACK_ORIGIN}${new URL(url).pathname}`;
  if (retry === url) throw new Error("not reachable");

  const res = await fetch(retry, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} (also tried ${MEDIA_FALLBACK_ORIGIN})`);
  return res;
}

async function uploadImage(url, alt) {
  // Two very different failures used to arrive wearing the same words. The
  // caller reports the source URL, so an upload that Strapi refused read as
  // "could not fetch this picture from the old site" — and sent us auditing a
  // WordPress install that had done nothing wrong. Label them at the source.
  let res;
  try {
    res = await fetchImage(url);
  } catch (err) {
    throw new Error(`could not read the image: ${err.message}`);
  }

  const blob = await res.blob();
  const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "image");

  const form = new FormData();
  form.append("files", blob, name);
  form.append("fileInfo", JSON.stringify({ name, alternativeText: alt || name }));

  try {
    const [file] = await api("/api/upload", { method: "POST", body: form });
    return file;
  } catch (err) {
    throw new Error(`Strapi would not store it: ${err.message}`);
  }
}

/**
 * Replaces the old site's image URLs inside the body with uploaded copies.
 *
 * Returns the block array to store. An image that cannot be fetched is dropped
 * rather than left pointing at the old site: a block whose URL breaks later is
 * harder to find than one that was never there, and the log names each one.
 */
async function localiseImages(blocks, cache, report) {
  const out = [];
  for (const block of blocks) {
    if (block.type !== "image" || !block.image?.url) {
      out.push(block);
      continue;
    }
    const url = block.image.url;
    try {
      if (!cache.has(url)) cache.set(url, await uploadImage(url, block.image.alternativeText));
      out.push({ ...block, image: cache.get(url) });
    } catch (err) {
      report.push(`inline image dropped (${url}): ${err.message}`);
    }
  }
  return out;
}

/**
 * Uploads the images, then hands the rest to the shared create.
 */
async function importPost(post, tags, imageCache, report, { draft }) {
  const cover = post.coverImageUrl
    ? await uploadImage(post.coverImageUrl, post.coverImageAlt).catch((err) => {
        report.push(`cover image dropped (${post.coverImageUrl}): ${err.message}`);
        return null;
      })
    : null;

  const body = await localiseImages(post.body, imageCache, report);
  const tagId = tags.get(post.tagKey);

  const data = {
    title: post.title,
    slug: post.slug,
    summary: post.summary || undefined,
    body,
    published_date: post.publishedDate,
    read_time_min: post.readTimeMin,
    ...(cover ? { cover_image: cover.id } : {}),
    ...(tagId ? { tags: [tagId] } : {}),
  };

  return createInBothLocales("news-posts", data, { draft });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      "Usage: STRAPI_URL=... STRAPI_API_TOKEN=... node scripts/import-legacy-news.mjs\n" +
        "       [--in FILE] [--dry-run] [--limit N] [--draft]"
    );
    return;
  }

  requireToken();

  const posts = JSON.parse(await readFile(args.in, "utf8"));
  console.log(`Read ${posts.length} posts from ${args.in}`);
  console.log(`Target ${STRAPI_URL}\n`);

  const [have, tags] = await Promise.all([existingSlugs("news-posts"), tagsByKey()]);
  console.log(`CMS already holds ${have.size} news posts`);

  const missingTags = [...new Set(posts.map((p) => p.tagKey))].filter((k) => !tags.has(k));
  if (missingTags.length) {
    console.log(`  note: no tag in the CMS for ${missingTags.join(", ")} — those posts import untagged`);
  }

  let todo = posts.filter((post) => !have.has(post.slug));
  const skipped = posts.length - todo.length;
  if (args.limit) todo = todo.slice(0, args.limit);

  console.log(`  ${skipped} already imported, skipping`);
  console.log(`  ${todo.length} to create\n`);

  if (!todo.length) return;

  if (args.dryRun) {
    for (const post of todo) {
      console.log(
        `  would create  ${post.publishedDate}  [${post.tagKey}]  ${post.slug}\n` +
          `                ${post.title.slice(0, 78)}`
      );
    }
    console.log(`\nDry run — nothing was written. Re-run without --dry-run to import.`);
    return;
  }

  const imageCache = new Map();
  const report = [];
  let done = 0;

  for (const post of todo) {
    try {
      await importPost(post, tags, imageCache, report, { draft: args.draft });
      done += 1;
      console.log(`  [${done}/${todo.length}] ${post.slug}`);
    } catch (err) {
      report.push(`FAILED ${post.slug}: ${err.message}`);
      console.error(`  [!] ${post.slug}: ${err.message}`);
    }
  }

  console.log(
    `\nCreated ${done} of ${todo.length}, ${args.draft ? "as drafts" : "published"}.`
  );
  if (report.length) {
    console.log("\nWorth a look:");
    for (const line of report) console.log(`  - ${line}`);
  }
  console.log(
    args.draft
      ? "\nReview them in the admin, then publish the ones that should be live."
      : "\nThese are live now. Check them on /news and unpublish anything that should not be."
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
