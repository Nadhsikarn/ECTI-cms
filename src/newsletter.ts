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

/**
 * Whether a switch someone typed into a dashboard is on.
 *
 * This was `=== 'true'`, and the first person to configure it in Strapi Cloud
 * typed TRUE. The feature stayed off, the log line said it was not enabled, and
 * nothing connected that to the setting that looked correct on screen.
 *
 * Case and surrounding space carry no meaning here, and neither does the choice
 * between true, yes and 1 — a switch that only accepts one spelling of on is
 * a trap rather than a safeguard. Anything else is still off, so the guard
 * against an accidental send is intact.
 */
function isOn(value: string | undefined): boolean {
  const normalised = (value ?? '').trim().toLowerCase();
  return normalised === 'true' || normalised === 'yes' || normalised === '1';
}

/**
 * The origin every "read the full story" button in a campaign points at.
 *
 * Returns an empty string for anything a subscriber could not follow, and the
 * send is abandoned rather than mailed with a broken link. A newsletter is the
 * one thing here that cannot be corrected after the fact: the campaign leaves,
 * and every copy keeps whatever address it was built with. A missing campaign
 * is a bad afternoon; a campaign linking every reader to their own machine is
 * a bad afternoon that is already in a thousand inboxes.
 *
 * localhost is called out separately because it is what a value copied from a
 * development setup looks like, and it is the one that reads as fine on the
 * screen of the person who set it.
 */
function resolveSiteUrl(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(parsed.hostname)) return '';

  return trimmed;
}

function readConfig(): NewsletterConfig {
  return {
    enabled: isOn(process.env.NEWSLETTER_ENABLED),
    apiKey: process.env.BREVO_API_KEY,
    listId: Number(process.env.BREVO_LIST_ID),
    senderName: process.env.NEWSLETTER_SENDER_NAME || 'ECTI Association',
    senderEmail: process.env.NEWSLETTER_SENDER_EMAIL,
    siteUrl: resolveSiteUrl(process.env.PUBLIC_SITE_URL),
  };
}

/** Reports what is missing rather than failing halfway through a send. */
function missingConfig(cfg: NewsletterConfig): string[] {
  const missing: string[] = [];
  if (!cfg.apiKey) missing.push('BREVO_API_KEY');
  if (!cfg.listId) missing.push('BREVO_LIST_ID');
  if (!cfg.senderEmail) missing.push('NEWSLETTER_SENDER_EMAIL');
  if (!cfg.siteUrl) {
    missing.push(
      `PUBLIC_SITE_URL (currently ${JSON.stringify(process.env.PUBLIC_SITE_URL ?? null)} — ` +
        `needs a public https address, not localhost)`
    );
  }
  return missing;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Sampled from the logo, so the mail and the site agree on the brand. */
const BRAND_BLUE = '#0b3d91';
const BRAND_RED = '#aa1e1e';
const INK = '#16202b';
const INK_SOFT = '#5a6875';
const RULE = '#dde4ec';
const GROUND = '#eef1f5';

type Lang = 'th' | 'en';

/**
 * Which language the mail should speak.
 *
 * Read off the post itself rather than the locale row it sits in. The legacy
 * import filled both locales with the same text, so a post's `th` row is very
 * often English, and dressing it in Thai chrome and linking it to /th would
 * describe it wrongly in both places.
 *
 * A single Thai character is enough: no English news title contains one, and a
 * Thai title without one does not exist.
 */
function detectLang(text: string): Lang {
  return /[\u0E00-\u0E7F]/.test(text) ? 'th' : 'en';
}

const COPY: Record<Lang, {
  eyebrow: string;
  invite: string;
  cta: string;
  org: string;
  why: string;
  logoAlt: string;
}> = {
  th: {
    eyebrow: 'ข่าวสารจากสมาคม',
    invite: 'อ่านรายละเอียดทั้งหมด พร้อมกำหนดการและเอกสารที่เกี่ยวข้อง ได้ที่เว็บไซต์สมาคม',
    cta: 'อ่านข่าวฉบับเต็ม',
    org: 'สมาคมวิชาการไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคม และสารสนเทศ',
    why: 'คุณได้รับอีเมลฉบับนี้เพราะสมัครรับข่าวสารจากสมาคม ECTI',
    logoAlt: 'สมาคม ECTI',
  },
  en: {
    eyebrow: 'News from the association',
    invite: 'Read the full announcement, with dates and related documents, on the ECTI website',
    cta: 'Read the full story',
    org: 'Electrical Engineering/Electronics, Computer, Telecommunications and Information Technology Association',
    why: 'You are receiving this because you subscribed to ECTI news',
    logoAlt: 'ECTI Association',
  },
};

/**
 * The campaign body.
 *
 * Tables and inline styles throughout, which is not how anyone would write a
 * page in 2026 and is still how mail has to be written: Outlook renders through
 * Word, and Gmail strips anything in a <style> block. Flex, grid, class
 * selectors and web fonts are all out.
 *
 * A preheader opens it — the line a client shows next to the subject in the
 * inbox list. Left out, that space fills with whatever text comes first, which
 * here would be the words "News from the association" on every single mail.
 *
 * The logo is an absolute URL against the public site rather than an
 * attachment, and every layer under it is styled so the mail still reads as
 * intended when a client blocks images, which many do by default.
 */
function buildHtml(
  post: { title: string; summary?: string },
  url: string,
  logoUrl: string,
  lang: Lang
): string {
  const t = COPY[lang];
  // The slug is a uid field and cannot currently hold a quote, but it reaches
  // here from the database and the cost of not trusting it is one call.
  const href = escapeHtml(url);
  const title = escapeHtml(post.title);
  const summary = post.summary ? escapeHtml(post.summary) : '';
  const font = "'Noto Sans Thai',Tahoma,'Helvetica Neue',Arial,sans-serif";

  // Trimmed because a preheader that runs long is padded by the client with the
  // start of the body, which reads as a stutter in the inbox list.
  const preheader = escapeHtml((post.summary || post.title).slice(0, 140));

  return [
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>`,

    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GROUND};margin:0;padding:24px 12px">`,
    '<tr><td align="center">',

    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden">`,

    // ── masthead ──────────────────────────────────────────────────────
    `<tr><td align="center" style="padding:28px 32px 22px">`,
    `<img src="${logoUrl}" width="320" alt="${t.logoAlt}" style="display:block;width:320px;max-width:70%;height:auto;border:0">`,
    '</td></tr>',

    `<tr><td style="padding:0 32px"><div style="height:3px;background:${BRAND_RED};border-radius:2px"></div></td></tr>`,

    // ── body ──────────────────────────────────────────────────────────
    `<tr><td style="padding:26px 32px 0;font-family:${font}">`,
    `<p style="margin:0 0 10px;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:${BRAND_BLUE};font-weight:700">${t.eyebrow}</p>`,
    `<h1 style="margin:0 0 14px;font-size:23px;line-height:1.35;color:${INK};font-weight:700">${title}</h1>`,
    summary
      ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.75;color:${INK_SOFT}">${summary}</p>`
      : '',
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:${INK_SOFT}">${t.invite}</p>`,
    '</td></tr>',

    // ── call to action ────────────────────────────────────────────────
    // A table rather than a padded <a>: Outlook ignores padding on an inline
    // element, which would collapse the button into a bare blue link.
    `<tr><td style="padding:0 32px 30px">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    `<td align="center" style="background:${BRAND_BLUE};border-radius:6px">`,
    `<a href="${href}" style="display:inline-block;padding:13px 30px;font-family:${font};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${t.cta}</a>`,
    '</td></tr></table>',
    '</td></tr>',

    // ── footer ────────────────────────────────────────────────────────
    `<tr><td style="padding:0 32px"><div style="height:1px;background:${RULE}"></div></td></tr>`,
    `<tr><td style="padding:20px 32px 28px;font-family:${font}">`,
    `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${INK};font-weight:700">${t.org}</p>`,
    `<p style="margin:0;font-size:12px;line-height:1.6;color:${INK_SOFT}">${t.why}</p>`,
    '</td></tr>',

    '</table></td></tr></table>',
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

  // Language, link and copy all follow the post's own text — see detectLang.
  const lang = detectLang(`${post.title} ${post.summary ?? ''}`);
  const url = `${cfg.siteUrl || '(no PUBLIC_SITE_URL)'}/${lang}/news/${post.slug}`;
  const logoUrl = `${cfg.siteUrl}/images/ecti-logo-email.png`;

  if (!cfg.enabled) {
    strapi.log.info(
      `[newsletter] NEWSLETTER_ENABLED is ${JSON.stringify(process.env.NEWSLETTER_ENABLED ?? null)}, which is not on — ` +
        `would have prepared a draft for "${post.title}" (${url}) on list ${cfg.listId || '?'}.`
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
      htmlContent: buildHtml(post, url, logoUrl, lang),
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
      `[newsletter] Draft campaign ${created.data.id} ready for "${post.title}" [${lang}], linking to ${url} — ` +
        `review and send it at https://app.brevo.com/campaigns`
    );
  } catch (err) {
    strapi.log.error(`[newsletter] Failed to broadcast "${post.title}": ${err?.stack || err}`);
  }
}
