'use strict';

/**
 * Marks every news post that already exists as having had its newsletter
 * handled, so switching the newsletter on later does not treat the archive as
 * a backlog waiting to be announced.
 *
 * The ~60 posts imported from the old WordPress site were written while
 * `NEWSLETTER_ENABLED` was unset, so none of them carry the flag that
 * `src/newsletter.ts` uses to skip a re-publish. Without this, turning the
 * newsletter on and re-publishing the archive would prepare one Brevo draft
 * per post. Nothing would be sent — a draft still needs a person — but it
 * leaves a mess for whoever finds it.
 *
 * Two details worth keeping if this is ever adapted:
 *
 * - It writes through knex rather than the Document Service, so none of the
 *   middleware in `src/index.ts` runs. Doing this over the REST API instead
 *   would fire the publish hook and create the very campaigns it is meant to
 *   prevent.
 *
 * - It marks *every row* of a document, draft rows included, the same way
 *   `src/newsletter.ts` does. Publishing copies the draft row forward, so a
 *   draft left at `false` would hand the flag back on the next publish.
 *
 * Only documents that are already published are touched. A post still sitting
 * unpublished is upcoming news, not archive, and should get its campaign when
 * it goes live.
 */

async function up(knex) {
  // A brand-new database has nothing to backfill, and the column may not exist
  // yet — Strapi syncs content-type schemas separately from these migrations.
  if (!(await knex.schema.hasTable('news_posts'))) return;
  if (!(await knex.schema.hasColumn('news_posts', 'newsletter_sent'))) return;

  const publishedDocuments = knex('news_posts')
    .distinct('document_id')
    .whereNotNull('published_at')
    .whereNotNull('document_id');

  const rows = await knex('news_posts')
    .whereIn('document_id', publishedDocuments)
    .update({ newsletter_sent: true });

  console.log(`[migration] newsletter_sent set on ${rows} existing news_posts rows`);
}

async function down() {
  // Deliberately empty. The previous value of the flag is not recorded
  // anywhere, so clearing it again would be a guess — and guessing wrong here
  // means a campaign for a post that was announced years ago.
}

module.exports = { up, down };
