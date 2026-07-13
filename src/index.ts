import type { Core } from '@strapi/strapi';
import { seed } from './seed';

const MUTATING_ACTIONS = new Set([
  'create',
  'update',
  'delete',
  'publish',
  'unpublish',
  'clone',
]);

async function sendWebhook(
  strapi: Core.Strapi,
  event: string,
  uid: string,
  documentId?: string
) {
  const url = process.env.WEBHOOK_URL;
  const secret = process.env.WEBHOOK_SECRET;

  if (!url) return;

  const payload = {
    event,
    uid,
    documentId,
    triggeredAt: new Date().toISOString(),
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Webhook-Secret': secret } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    strapi.log.warn(`[webhook] Failed to send event "${event}" to ${url}: ${err}`);
  }
}

async function enablePublicPermissions(strapi: Core.Strapi) {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) return;

  const publicApis = [
    'api::news-post.news-post',
    'api::tag.tag',
    'api::board-member.board-member',
    'api::milestone.milestone',
    'api::mission-vision.mission-vision',
    'api::objective.objective',
    'api::activity.activity',
    'api::benefit.benefit',
    'api::member-type.member-type',
    'api::howto-join.howto-join',
    'api::question.question',
    'api::resource.resource',
    'api::journal.journal',
    'api::contact.contact',
    'api::social-link.social-link',
    'api::membership-apply.membership-apply',
    'api::membership-payment.membership-payment',
    'api::membership-credit.membership-credit',
    'api::membership-document.membership-document',
  ];

  const actions = ['find', 'findOne'];

  for (const uid of publicApis) {
    for (const action of actions) {
      const actionKey = `${uid}.${action}`;
      const exists = await strapi.db
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action: actionKey, role: publicRole.id } });

      if (!exists) {
        await strapi.db.query('plugin::users-permissions.permission').create({
          data: { action: actionKey, role: publicRole.id },
        });
        strapi.log.info(`[permissions] Enabled public: ${actionKey}`);
      }
    }
  }
}

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.documents.use(async (ctx, next) => {
      const result = await next();

      if (MUTATING_ACTIONS.has(ctx.action)) {
        const documentId =
          typeof ctx.params === 'object' && ctx.params !== null && 'documentId' in ctx.params
            ? (ctx.params as { documentId?: string }).documentId
            : undefined;

        sendWebhook(strapi, ctx.action, ctx.uid, documentId).catch(() => {});
      }

      return result;
    });

    // Auto-stamp Journal.published_date with the current publish time.
    // We update the draft *before* publishing so the published clone inherits
    // it and both versions show the value in the admin form.
    strapi.documents.use(async (ctx, next) => {
      if (ctx.uid === 'api::journal.journal' && ctx.action === 'publish') {
        const documentId =
          typeof ctx.params === 'object' && ctx.params !== null && 'documentId' in ctx.params
            ? (ctx.params as { documentId?: string }).documentId
            : undefined;

        if (documentId) {
          await strapi.documents('api::journal.journal').update({
            documentId,
            data: { published_date: new Date().toISOString() } as any,
          });
        }
      }

      return next();
    });
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // ── Ensure locales exist ──────────────────────────────────────────────
    const localeService = strapi.plugin('i18n').service('locales');

    const existing: { code: string }[] = await localeService.find();
    const existingCodes = new Set(existing.map((l) => l.code));

    const toCreate = [
      { code: 'th', name: 'Thai (th)', isDefault: true },
      { code: 'en', name: 'English (en)', isDefault: false },
    ];

    for (const locale of toCreate) {
      if (!existingCodes.has(locale.code)) {
        await localeService.create(locale);
        strapi.log.info(`[i18n] Created locale: ${locale.code}`);
      }
    }

    // ── Enable public read permissions ───────────────────────────────────
    await enablePublicPermissions(strapi);

    // ── Seed demo content ─────────────────────────────────────────────────
    await seed(strapi);
  },
};
