#!/usr/bin/env node
/**
 * Feeds the file scrape-legacy-conferences.mjs produced into Strapi, as
 * activities.
 *
 * Conferences map onto api::activity.activity rather than api::conference —
 * that one is the short "which conferences does ECTI run" summary on the
 * publications page, four rows with no dates. The events page reads activities,
 * which is where a dated list of 41 past conferences belongs.
 *
 * Skips anything already there, matched on slug, so a re-run is safe.
 *
 * Unlike the news import these do NOT arrive as drafts — api::activity.activity
 * has draftAndPublish turned off (see issue #33: it is waiting on a paid Strapi
 * Cloud plan), so there is no unpublished state to hold them in and every one of
 * them is live the moment it is created. Run --dry-run first, and --limit 2 after
 * that; undoing a full run means deleting 41 entries by hand.
 *
 *   STRAPI_URL=... STRAPI_API_TOKEN=... node scripts/import-legacy-conferences.mjs --dry-run
 *   STRAPI_URL=... STRAPI_API_TOKEN=... node scripts/import-legacy-conferences.mjs
 *
 * The token needs write access to activity.
 */

import { readFile } from "node:fs/promises";
import { existingSlugs, createInBothLocales, requireToken, STRAPI_URL } from "./lib/strapi.mjs";

const DEFAULT_IN = "scripts/data/legacy-conferences.json";

function parseArgs(argv) {
  const args = { in: DEFAULT_IN, dryRun: false, limit: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--in") args.in = argv[++i];
    else if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--limit") args.limit = Number(argv[++i]);
    else if (flag === "--help" || flag === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

/**
 * The title is the short name — "ECTI-CON 2016" — with the full conference name
 * in the description. That is the shape the seeded activities already use and
 * what the events page is laid out for: the card shows the title as a label and
 * the description underneath.
 *
 * `location` is left unset. The old page never recorded where any of these were
 * held, and an empty field is honest where a guess would not be.
 */
function toActivity(conference) {
  return {
    title: conference.name,
    slug: conference.slug,
    description: conference.description,
    year: conference.year ?? undefined,
    type: conference.type,
    event_status: conference.eventStatus,
    event_start_date: conference.startDate ?? undefined,
    event_end_date: conference.endDate ?? undefined,
    register_url: conference.registerUrl ?? undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      "Usage: STRAPI_URL=... STRAPI_API_TOKEN=... node scripts/import-legacy-conferences.mjs\n" +
        "       [--in FILE] [--dry-run] [--limit N]"
    );
    return;
  }

  requireToken();

  const conferences = JSON.parse(await readFile(args.in, "utf8"));
  console.log(`Read ${conferences.length} conferences from ${args.in}`);
  console.log(`Target ${STRAPI_URL}\n`);

  const have = await existingSlugs("activities");
  console.log(`CMS already holds ${have.size} activities`);

  let todo = conferences.filter((conference) => !have.has(conference.slug));
  const skipped = conferences.length - todo.length;
  if (args.limit) todo = todo.slice(0, args.limit);

  console.log(`  ${skipped} already imported, skipping`);
  console.log(`  ${todo.length} to create\n`);

  if (!todo.length) return;

  if (args.dryRun) {
    for (const conference of todo) {
      console.log(
        `  would create  ${conference.startDate ?? "no date  "}  [${conference.eventStatus}]  ` +
          `${conference.slug}\n                ${conference.title.slice(0, 76) || conference.name}`
      );
    }
    console.log(
      "\nDry run — nothing was written. These publish immediately when created,\n" +
        "so read the list above before re-running without --dry-run."
    );
    return;
  }

  const report = [];
  let done = 0;

  for (const conference of todo) {
    try {
      await createInBothLocales("activities", toActivity(conference));
      done += 1;
      console.log(`  [${done}/${todo.length}] ${conference.slug}`);
    } catch (err) {
      report.push(`FAILED ${conference.slug}: ${err.message}`);
      console.error(`  [!] ${conference.slug}: ${err.message}`);
    }
  }

  console.log(`\nCreated ${done} of ${todo.length}.`);
  console.log(
    "  These are live: api::activity.activity has draftAndPublish off (issue #33),\n" +
      "  so there is no draft state to review them in."
  );

  const noUrl = todo.filter((c) => !c.registerUrl).length;
  if (noUrl) {
    console.log(
      `  ${noUrl} have no website link — the old page had no button for them, ` +
        `and those conference sites are long gone.`
    );
  }
  if (report.length) {
    console.log("\nWorth a look:");
    for (const line of report) console.log(`  - ${line}`);
  }
  console.log(
    "\nThey show on /events under the 'Past' status filter. Check them there,\n" +
      "and delete any that should not have come across."
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
