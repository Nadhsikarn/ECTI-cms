#!/usr/bin/env node
/**
 * Pulls the conference list off the old WordPress site into a JSON file.
 *
 * Unlike the news archive, this is not a set of posts — it is one Avada-built
 * page holding a single table of 39 past conferences plus a couple of countdown
 * widgets for upcoming ones. So there is no REST collection to read; the page's
 * HTML is the data, and this reads it out of the page body the API returns.
 *
 *   node scripts/scrape-legacy-conferences.mjs
 *   node scripts/scrape-legacy-conferences.mjs --out /tmp/conf.json
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "node-html-parser";

const DEFAULT_SOURCE = "https://ecti-thailand.org";
const DEFAULT_SLUG = "conference-activities";
const DEFAULT_OUT = "scripts/data/legacy-conferences.json";

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseArgs(argv) {
  const args = { source: DEFAULT_SOURCE, slug: DEFAULT_SLUG, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--source") args.source = argv[++i];
    else if (flag === "--slug") args.slug = argv[++i];
    else if (flag === "--out") args.out = argv[++i];
    else if (flag === "--help" || flag === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

function clean(value) {
  return (value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Reads the "Date : 18-20 January 2023" line the table puts under each title.
 *
 * Two shapes appear: a day range within one month, and a single day. Anything
 * else is left null rather than guessed at — a conference with no dates is
 * still worth importing, and a wrong date is worse than a missing one.
 */
function parseDateRange(value) {
  const range = value.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (range) {
    const month = MONTHS[range[3].toLowerCase()];
    if (month) {
      return {
        start: iso(range[4], month, range[1]),
        end: iso(range[4], month, range[2]),
        year: Number(range[4]),
      };
    }
  }

  const single = value.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (single) {
    const month = MONTHS[single[2].toLowerCase()];
    if (month) {
      return { start: iso(single[3], month, single[1]), end: null, year: Number(single[3]) };
    }
  }

  const year = value.match(/\b(19|20)\d{2}\b/);
  return { start: null, end: null, year: year ? Number(year[0]) : null };
}

/**
 * "ECTI-CON2022" and "APSIPA-ASC 2014" both need to come out as a slug that
 * reads like the ones already in the CMS (`ecti-con-2026` is seeded), so the
 * year gets separated from the name whether or not the old page spaced it.
 */
function slugify(name) {
  return name
    .replace(/([A-Za-z])(\d{4})\b/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Some links on the page are typed with one slash ("http:/www.example.org").
 * The URL parser repairs that; anything it cannot parse is dropped, since a
 * broken href is worse than no button.
 */
function normaliseUrl(href) {
  if (!href) return null;
  try {
    return new URL(href.trim()).href;
  } catch {
    return null;
  }
}

/**
 * Where the conference sits relative to today, rather than which section of the
 * old page it was in. The "Upcoming" widgets on that page count down to dates in
 * 2024 and 2025 — nobody updated them — so trusting the heading would import two
 * finished conferences as upcoming ones.
 */
function statusFor({ start, end }) {
  if (!start) return "finished";
  const last = new Date(`${end ?? start}T23:59:59Z`);
  return last.getTime() < Date.now() ? "finished" : "upcoming";
}

function description(text) {
  return text ? [{ type: "paragraph", children: [{ type: "text", text }] }] : [];
}

/** The 39-row "Past Conference" table: name in bold, title, then the date line. */
function readTable(root) {
  const table = root.querySelector("table");
  if (!table) return [];

  return table.querySelectorAll("tbody tr").flatMap((row) => {
    const cells = row.querySelectorAll("td");
    const name = clean(cells[0]?.querySelector("strong")?.text);
    if (!name) return [];

    // Drop the bold name, then split the rest on the date label.
    const rest = clean(
      (cells[0]?.innerHTML ?? "").replace(/<strong>.*?<\/strong>/s, "").replace(/<[^>]+>/g, " ")
    );
    const dateMatch = rest.match(/Date\s*:\s*(.+)$/i);
    const title = (dateMatch ? rest.slice(0, dateMatch.index) : rest).trim();
    const dates = parseDateRange(dateMatch?.[1] ?? "");

    // The second column is an Avada button: a <style> block and one link.
    const url = normaliseUrl(cells[1]?.querySelector("a")?.getAttribute("href"));

    return [{ name, title, url, ...dates }];
  });
}

/**
 * The countdown widgets above the table.
 *
 * The date lives in a data-timer attribute on an inner counter div, while the
 * name and the Register link sit on the widget that wraps it — so this starts
 * at the timer and walks out until it finds the wrapper carrying a heading.
 */
function readCountdowns(root) {
  return root
    .querySelectorAll("[data-timer]")
    .flatMap((timerNode) => {
      const [y, m, d] = (timerNode.getAttribute("data-timer") ?? "").split("-");
      const start = y && m && d ? iso(y, Number(m), Number(d)) : null;

      let wrapper = timerNode;
      let heading = null;
      // Six levels is well past the widget and short of the page body, which is
      // where a stray heading would start belonging to something else.
      for (let depth = 0; wrapper && depth < 6; depth += 1) {
        heading = wrapper.querySelector?.(".fusion-countdown-heading");
        if (heading) break;
        wrapper = wrapper.parentNode;
      }

      const name = clean(heading?.text);
      if (!name || !wrapper) return [];

      const url = normaliseUrl(wrapper.querySelector("a")?.getAttribute("href"));
      return [{ name, title: "", url, start, end: null, year: start ? Number(y) : null }];
    });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      "Usage: node scripts/scrape-legacy-conferences.mjs [--source URL] [--slug PAGE] [--out FILE]"
    );
    return;
  }

  const source = args.source.replace(/\/+$/, "");
  const url = `${source}/wp-json/wp/v2/pages?slug=${encodeURIComponent(args.slug)}`;
  console.log(`Reading ${url}`);

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);

  const [page] = await res.json();
  if (!page) throw new Error(`No page found with slug "${args.slug}"`);

  const root = parse(page.content?.rendered ?? "");
  // Avada inlines a stylesheet per button; it is not content and its text would
  // otherwise land in a title.
  root.querySelectorAll("style, script").forEach((node) => node.remove());

  const found = [...readCountdowns(root), ...readTable(root)];

  // The countdown widgets repeat conferences that are also in the table on some
  // versions of this page. First one wins, which is the countdown — it is the
  // one with a date attribute rather than a parsed string.
  const seen = new Set();
  const conferences = [];
  for (const item of found) {
    const slug = slugify(item.name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    conferences.push({
      slug,
      name: item.name.replace(/([A-Za-z])(\d{4})\b/g, "$1 $2"),
      title: item.title,
      description: description(item.title),
      year: item.year,
      type: "conference",
      eventStatus: statusFor(item),
      startDate: item.start,
      endDate: item.end,
      registerUrl: item.url,
      sourceUrl: page.link,
    });
  }

  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(conferences, null, 2)}\n`, "utf8");

  const noDate = conferences.filter((c) => !c.startDate).length;
  const noUrl = conferences.filter((c) => !c.registerUrl).length;

  console.log(`\nWrote ${conferences.length} conferences to ${args.out}`);
  if (noDate) console.log(`  ${noDate} have no parseable date`);
  if (noUrl) console.log(`  ${noUrl} have no website link`);
  console.log("\nNext: node scripts/import-legacy-conferences.mjs --dry-run");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
