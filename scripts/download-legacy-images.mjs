/**
 * Pulls every image the legacy archives point at onto disk, so the archive is
 * an archive.
 *
 * legacy-news.json stores image URLs, not images. That is fine while the old
 * WordPress site is up and completely useless the day it isn't: the text
 * survives in git and all 71 pictures go with the server. The import copies
 * them into Strapi, but only at the moment it runs — and it has not run yet.
 *
 * This closes that window. Run it once, commit the result, and the import can
 * be done next month against a site that is already switched off.
 *
 * Files land in scripts/data/images/ named `<hash>-<original name>`: the hash
 * because WordPress happily serves two different pictures called image.jpg from
 * two different month folders, the original name because someone will open this
 * directory in five years and want to know what they are looking at.
 *
 *   node scripts/download-legacy-images.mjs
 *   node scripts/download-legacy-images.mjs --force   # re-fetch what is there
 *
 * Re-running skips files already on disk, so an interrupted run just carries on.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "data");
const IMAGE_DIR = join(DATA_DIR, "images");
const MANIFEST = join(IMAGE_DIR, "manifest.json");

/** Same retry host the import uses — see MEDIA_FALLBACK_ORIGIN there. */
const FALLBACK_ORIGIN = (
  process.env.LEGACY_MEDIA_ORIGIN || "https://ecti-thailand.org"
).replace(/\/+$/, "");

/** Eight hex characters is plenty to separate 72 files and stays readable. */
function hashFor(url) {
  return createHash("sha1").update(url).digest("hex").slice(0, 8);
}

/**
 * A filename that survives a checkout on any machine.
 *
 * One image on the old site is called จับภาพ-300x268.png. Thai in a filename is
 * legal everywhere that matters, but it is also the one file that no longer
 * exists, so this has never had to prove itself — the transliteration-free
 * fallback keeps the hash and drops the rest rather than inventing a name.
 */
function fileNameFor(url) {
  const raw = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  const safe = raw.replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "");
  const ext = (raw.match(/\.(jpe?g|png|gif|webp)$/i) || [, "jpg"])[1];
  return `${hashFor(url)}-${safe || `image.${ext}`}`;
}

/** Every image URL either archive refers to, cover images and inline both. */
async function collectUrls() {
  const urls = new Map(); // url -> what refers to it, for the report

  const newsPath = join(DATA_DIR, "legacy-news.json");
  const news = JSON.parse(await readFile(newsPath, "utf8"));

  for (const post of news) {
    if (post.coverImageUrl) urls.set(post.coverImageUrl, post.slug);
    // Inline images live inside the blocks array; walking the JSON is simpler
    // and safer than knowing the block shape, which the converter may change.
    JSON.stringify(post.body ?? "").replace(
      /https?:\/\/[^"\\ ]+?\.(?:jpe?g|png|gif|webp)/gi,
      (match) => urls.set(match, post.slug)
    );
  }

  return urls;
}

/** Fetch with the same fallback the import uses, so both agree on what exists. */
async function download(url) {
  const attempt = async (target) => {
    const res = await fetch(target, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };

  try {
    return { body: await attempt(url), via: "direct" };
  } catch (err) {
    const retry = `${FALLBACK_ORIGIN}${new URL(url).pathname}`;
    if (retry === url) throw err;
    return { body: await attempt(retry), via: "fallback" };
  }
}

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function main() {
  const force = process.argv.includes("--force");

  await mkdir(IMAGE_DIR, { recursive: true });

  const urls = await collectUrls();
  console.log(`${urls.size} images referenced by the archive.\n`);

  const manifest = {};
  const failed = [];
  let fetched = 0;
  let skipped = 0;
  let bytes = 0;

  for (const [url, usedBy] of urls) {
    const name = fileNameFor(url);
    const path = join(IMAGE_DIR, name);

    if (!force && (await exists(path))) {
      const size = (await stat(path)).size;
      manifest[url] = { file: name, bytes: size, usedBy };
      bytes += size;
      skipped += 1;
      continue;
    }

    try {
      const { body, via } = await download(url);
      await writeFile(path, body);
      manifest[url] = { file: name, bytes: body.length, usedBy, via };
      bytes += body.length;
      fetched += 1;
      process.stdout.write(
        `  ${via === "fallback" ? "↳" : "·"} ${name} (${(body.length / 1024).toFixed(0)} KB)\n`
      );
    } catch (err) {
      failed.push({ url, usedBy, reason: err.message });
      process.stdout.write(`  ✗ ${url}\n      ${err.message}\n`);
    }
  }

  // Sorted so the committed file does not churn on the order a Map happens to
  // iterate in, which would make every re-run look like a change.
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");

  console.log(`\nDownloaded ${fetched}, already had ${skipped}, ${(bytes / 1048576).toFixed(1)} MB on disk.`);
  console.log(`Manifest: scripts/data/images/manifest.json`);

  if (failed.length > 0) {
    console.log(`\n${failed.length} could not be fetched from either host:`);
    for (const f of failed) console.log(`  ${f.url}\n    used by ${f.usedBy} — ${f.reason}`);
    console.log(
      `\nThese are gone from the old site too. The import drops an image it cannot\n` +
        `fetch rather than leaving a broken URL in the body.`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
