import type { Core } from '@strapi/strapi';

/**
 * Prepares a newsletter for a news post when it is published.
 *
 * It stops at a **draft campaign in Brevo** — a person still has to open Brevo
 * and press send. Publishing is one click and mistakes happen (a half-written
 * post, a publish just to see how the page looks); mail to the whole membership
 * cannot be recalled, so the last step stays human.
 *
 * Wired up from register() in src/index.ts, which watches for the `publish`
 * action on api::news-post.news-post.
 *
 * Two guards on top of that:
 *  - NEWSLETTER_ENABLED must be exactly "true". Anything else and we only log
 *    what *would* have been prepared, so importing the legacy news archive
 *    never touches Brevo at all.
 *  - `newsletter_sent` on the post itself, so re-publishing after a typo fix
 *    doesn't pile up duplicate drafts.
 */

const BREVO_API = 'https://api.brevo.com/v3';
const DRAIN_INTERVAL_MS = 2000;
/** How long after the publish request before we touch the database. */
const SETTLE_MS = 5000;

/**
 * Publishing runs inside a database transaction, and Strapi binds queries to it
 * for as long as it is open — a query that merely *overlaps* the publish picks
 * it up and then dies with "Transaction query already complete" once it commits.
 * A timer created outside the request is not enough on its own; the first
 * attempt here fired 30ms before the publish response and still got caught.
 *
 * So: hold each id until the request has certainly finished (SETTLE_MS), and do
 * the reads and writes through raw knex on the pool, which is never enrolled in
 * the document service's transaction.
 */
const pending = new Map<string, number>();

export function queueNewsPostBroadcast(documentId: string) {
  if (!pending.has(documentId)) pending.set(documentId, Date.now());
}

export function startNewsletterWorker(strapi: Core.Strapi) {
  const timer = setInterval(() => {
    if (pending.size === 0) return;

    const now = Date.now();
    const ready = [...pending.entries()]
      .filter(([, queuedAt]) => now - queuedAt >= SETTLE_MS)
      .map(([documentId]) => documentId);

    for (const documentId of ready) {
      pending.delete(documentId);
      broadcastNewsPost(strapi, documentId).catch((err) => {
        strapi.log.error(
          `[newsletter] Broadcast crashed for ${documentId}: ${err?.stack || err}`
        );
      });
    }
  }, DRAIN_INTERVAL_MS);

  // Don't hold the process open on shutdown.
  timer.unref?.();
}

interface NewsletterConfig {
  enabled: boolean;
  apiKey?: string;
  listId: number;
  senderName: string;
  senderEmail?: string;
  siteUrl: string;
}

function readConfig(): NewsletterConfig {
  return {
    enabled: process.env.NEWSLETTER_ENABLED === 'true',
    apiKey: process.env.BREVO_API_KEY,
    listId: Number(process.env.BREVO_LIST_ID),
    senderName: process.env.NEWSLETTER_SENDER_NAME || 'ECTI Association',
    senderEmail: process.env.NEWSLETTER_SENDER_EMAIL,
    siteUrl: (process.env.PUBLIC_SITE_URL || 'https://ecti-thailand.org').replace(/\/+$/, ''),
  };
}

/** Reports what is missing rather than failing halfway through a send. */
function missingConfig(cfg: NewsletterConfig): string[] {
  const missing: string[] = [];
  if (!cfg.apiKey) missing.push('BREVO_API_KEY');
  if (!cfg.listId) missing.push('BREVO_LIST_ID');
  if (!cfg.senderEmail) missing.push('NEWSLETTER_SENDER_EMAIL');
  return missing;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(post: { title: string; summary?: string }, url: string): string {
  return [
    '<div style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7;color:#1c2733">',
    `<h1 style="font-size:20px;line-height:1.4;margin:0 0 12px">${escapeHtml(post.title)}</h1>`,
    post.summary ? `<p style="margin:0 0 20px">${escapeHtml(post.summary)}</p>` : '',
    `<p style="margin:0 0 28px"><a href="${url}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;display:inline-block">อ่านข่าวฉบับเต็ม</a></p>`,
    '<hr style="border:none;border-top:1px solid #dde3ea;margin:0 0 16px">',
    '<p style="color:#5b6b7c;font-size:13px;margin:0">',
    'สมาคมวิชาการไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคม และสารสนเทศ (ECTI)',
    '</p></div>',
  ].join('');
}

async function brevo(
  cfg: NewsletterConfig,
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${BREVO_API}${path}`, {
    method: 'POST',
    headers: {
      'api-key': cfg.apiKey as string,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });

  // Some Brevo endpoints answer 204 with no body.
  let data: any = null;
  if (res.status !== 204) {
    data = await res.json().catch(() => null);
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Called fire-and-forget: a slow or broken Brevo must never stop an editor from
 * publishing. Everything below reports through strapi.log instead of throwing.
 */
export async function broadcastNewsPost(strapi: Core.Strapi, documentId: string) {
  strapi.log.info(`[newsletter] Publish detected for ${documentId} — checking whether to send.`);

  const cfg = readConfig();

  // Raw knex on the pool, not strapi.documents() — see the note on `pending`.
  const post: any = await strapi.db
    .connection('news_posts')
    .where({ document_id: documentId, locale: 'th' })
    .whereNotNull('published_at')
    .orderBy('id', 'desc')
    .first('id', 'title', 'slug', 'summary', 'newsletter_sent');

  if (!post) {
    strapi.log.warn(`[newsletter] Published news post ${documentId} not found — nothing sent.`);
    return;
  }

  if (post.newsletter_sent) {
    strapi.log.info(
      `[newsletter] "${post.title}" already has a campaign — skipping re-publish.`
    );
    return;
  }

  const url = `${cfg.siteUrl}/th/news/${post.slug}`;

  if (!cfg.enabled) {
    strapi.log.info(
      `[newsletter] NEWSLETTER_ENABLED is not "true" — would have prepared a draft for "${post.title}" (${url}) on list ${cfg.listId || '?'}.`
    );
    return;
  }

  const missing = missingConfig(cfg);
  if (missing.length > 0) {
    strapi.log.error(
      `[newsletter] Enabled but missing ${missing.join(', ')} — no draft created for "${post.title}".`
    );
    return;
  }

  try {
    const created = await brevo(cfg, '/emailCampaigns', {
      name: `${post.slug} · ${new Date().toISOString().slice(0, 16)}`,
      subject: post.title,
      sender: { name: cfg.senderName, email: cfg.senderEmail },
      type: 'classic',
      htmlContent: buildHtml(post, url),
      recipients: { listIds: [cfg.listId] },
    });

    if (!created.ok || !created.data?.id) {
      strapi.log.error(
        `[newsletter] Brevo refused to create the campaign for "${post.title}" (HTTP ${created.status}): ${JSON.stringify(created.data)}` +
          (created.status === 401 ? ' — check BREVO_API_KEY.' : '')
      );
      return;
    }

    // Deliberately no sendNow: the campaign stays a draft until a person
    // reviews it in Brevo and presses send.

    // Raw knex again, and deliberately not documents().update() — that would
    // re-enter this middleware and loop. Updating every row of the document
    // covers the draft and the other locale, so the flag holds whichever
    // version is read later.
    await strapi.db
      .connection('news_posts')
      .where({ document_id: documentId })
      .update({ newsletter_sent: true });

    strapi.log.info(
      `[newsletter] Draft campaign ${created.data.id} ready for "${post.title}" — review and send it at https://app.brevo.com/campaigns`
    );
  } catch (err) {
    strapi.log.error(`[newsletter] Failed to broadcast "${post.title}": ${err?.stack || err}`);
  }
}
