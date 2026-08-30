#!/usr/bin/env node
/**
 * Pulls the news archive off the old WordPress site into a JSON file.
 *
 * Reads WordPress' own REST API rather than scraping the rendered pages. The
 * old site runs Avada, whose markup is layers of nested builder divs around the
 * actual post — the API hands back the same content without them, along with
 * the publish date and featured image that the page only implies.
 *
 * This writes a file and touches nothing else. Feeding it into Strapi is
 * import-legacy-news.mjs, kept separate so the slow, rate-limited half can be
 * re-run against a file that already exists.
 *
 *   node scripts/scrape-legacy-news.mjs
 *   node scripts/scrape-legacy-news.mjs --out /tmp/news.json --limit 5
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { htmlToBlocks, blocksToText } from "./lib/html-to-blocks.mjs";

const DEFAULT_SOURCE = "https://ecti-thailand.org";
const DEFAULT_OUT = "scripts/data/legacy-news.json";
const PER_PAGE = 100;

/** Reading speed used for read_time_min. Thai and English land close enough. */
const WORDS_PER_MINUTE = 200;

/**
 * Strapi's uid field accepts this set and nothing else, so a percent-encoded
 * Thai slug — which is what WordPress stores for a Thai title — has to be
 * replaced rather than passed through.
 */
const SAFE_SLUG = /^[A-Za-z0-9._~-]+$/;

const THAI = /[฀-๿]/g;

function parseArgs(argv) {
  const args = { source: DEFAULT_SOURCE, out: DEFAULT_OUT, limit: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--source") args.source = argv[++i];
    else if (flag === "--out") args.out = argv[++i];
    else if (flag === "--limit") args.limit = Number(argv[++i]);
    else if (flag === "--help" || flag === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

async function fetchPage(source, page) {
  const url =
    `${source}/wp-json/wp/v2/posts` +
    `?per_page=${PER_PAGE}&page=${page}&_embed=1&orderby=date&order=desc`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  // Asking past the last page is a 400 with code rest_post_invalid_page_number,
  // which is the documented way to find out you are done.
  if (res.status === 400) return null;
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);

  const posts = await res.json();
  return posts.length ? posts : null;
}

/** Strips tags and decodes the entities WordPress leaves in title/excerpt. */
function plain(html) {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#8217;/g, "’")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * WordPress keeps the slug percent-encoded when the title is Thai. Those decode
 * to Thai text, which Strapi's uid field rejects, so they get an id-based slug
 * instead — ugly, but stable across re-runs, which is what the skip check needs.
 * An editor can rename it afterwards; the importer matches on it only once.
 */
function slugFor(post) {
  if (SAFE_SLUG.test(post.slug)) return post.slug;

  // Some slugs are half-ASCII ("workshop-%e0%b9%80..."); keep the readable part.
  const prefix = post.slug
    .replace(/%[0-9a-f]{2}/gi, "-")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return prefix.length >= 3 ? `${prefix}-${post.id}` : `legacy-${post.id}`;
}

/**
 * Which of the five tags in the CMS this post belongs under.
 *
 * The old site is no help here: every post carries the same four WordPress tags
 * and the single category "News". So this reads the title, which for this
 * archive is unusually descriptive — the posts announce what they are. Anything
 * unmatched becomes an announcement, which is the tag's stated purpose.
 */
function tagFor(title) {
  const t = title.toLowerCase();
  if (/call for (paper|submission)|cfp|submission deadline|ขอเชิญส่งบทความ/.test(t)) return "cfp";
  if (/workshop|training|tutorial|short course|อบรม|ฝึกอบรม/.test(t)) return "training";
  if (/conference|symposium|lecture|seminar|talk|congress|ประชุมวิชาการ|สัมมนา/.test(t)) return "academic";
  if (/journal|transactions|วารสาร/.test(t)) return "article";
  return "announcements";
}

/** Rough, and only used for the "n min read" label. */
function readTime(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  // Thai does not space between words, so count characters for the Thai part.
  const thai = (text.match(THAI) || []).length;
  const total = words + Math.round(thai / 5);
  return Math.max(1, Math.round(total / WORDS_PER_MINUTE));
}

/** First couple of sentences, for posts where WordPress has no excerpt. */
function summaryFrom(text) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 220) return trimmed;
  const cut = trimmed.slice(0, 220);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("ฯ"), cut.lastIndexOf(" "));
  return `${cut.slice(0, stop > 120 ? stop : 220).trim()}…`;
}

function normalise(post) {
  const title = plain(post.title?.rendered);
  const blocks = htmlToBlocks(post.content?.rendered ?? "");
  const text = blocksToText(blocks);
  const featured = post._embedded?.["wp:featuredmedia"]?.[0];

  return {
    // Everything below is what the importer sends to Strapi, plus the two
    // fields it needs to talk about a post in the log.
    wpId: post.id,
    sourceUrl: post.link,

    slug: slugFor(post),
    title,
    summary: plain(post.excerpt?.rendered) || summaryFrom(text),
    body: blocks,
    publishedDate: post.date_gmt?.slice(0, 10) ?? post.date?.slice(0, 10) ?? null,
    readTimeMin: readTime(text),
    tagKey: tagFor(title),
    coverImageUrl: featured?.source_url ?? null,
    coverImageAlt: plain(featured?.alt_text) || title,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      "Usage: node scripts/scrape-legacy-news.mjs [--source URL] [--out FILE] [--limit N]"
    );
    return;
  }

  const source = args.source.replace(/\/+$/, "");
  console.log(`Reading ${source}/wp-json/wp/v2/posts`);

  const raw = [];
  for (let page = 1; ; page += 1) {
    const posts = await fetchPage(source, page);
    if (!posts) break;
    raw.push(...posts);
    console.log(`  page ${page}: ${posts.length} posts (${raw.length} so far)`);
    if (args.limit && raw.length >= args.limit) break;
  }

  const wanted = args.limit ? raw.slice(0, args.limit) : raw;
  const posts = wanted.map(normalise);

  // A post with no title has nothing to show in a list and no way to be
  // identified in the admin; two of these exist on the old site as empty drafts.
  const usable = posts.filter((post) => post.title);
  const skipped = posts.length - usable.length;

  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(usable, null, 2)}\n`, "utf8");

  const noBody = usable.filter((p) => !p.body.length).length;
  const noCover = usable.filter((p) => !p.coverImageUrl).length;

  console.log(`\nWrote ${usable.length} posts to ${args.out}`);
  if (skipped) console.log(`  ${skipped} skipped for having no title`);
  if (noBody) console.log(`  ${noBody} have an empty body`);
  if (noCover) console.log(`  ${noCover} have no cover image`);
  console.log("\nNext: node scripts/import-legacy-news.mjs --dry-run");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
