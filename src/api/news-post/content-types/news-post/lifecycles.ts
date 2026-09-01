import { errors } from '@strapi/utils';

// Lifecycle hooks for the News Post content-type.
// - slug: shared across i18n locales. `slug` is a non-localized uid, but Strapi
//   does not propagate uid values to secondary-locale entries, so a new locale
//   (e.g. the English version of a Thai post) is created with slug = null. The
//   front-end keys/links on slug, so a null slug breaks the localized list page.
// - published_date / event_date: also non-localized (a post date and event date
//   are the same in every language). We copy them from a sibling locale for the
//   same reason, so both locales agree on one date.
// - published_date default: brand-new posts get "now" when left blank, but the
//   field stays editable so content migrated from the old site can be back-dated
//   to its original date.

type LifecycleEvent = {
  params: {
    data: {
      documentId?: string | null;
      locale?: string | null;
      slug?: string | null;
      published_date?: string | null;
      event_date?: string | null;
      event_end_date?: string | null;
      tags?: unknown;
    };
    where?: { id?: number };
  };
};

// Copy non-localized fields (slug, dates) from a sibling locale of the same
// document when the entry being written is missing them.
async function shareNonLocalizedFields(event: LifecycleEvent) {
  const { data } = event.params;

  const needsSlug = !data.slug;
  const needsPublishedDate = !data.published_date;
  const needsEventDate = !data.event_date;
  const needsEventEndDate = !data.event_end_date;

  // Nothing to copy, or no document to find siblings by.
  if (
    !data.documentId ||
    (!needsSlug && !needsPublishedDate && !needsEventDate && !needsEventEndDate)
  ) {
    return;
  }

  // Every row of the document, not one arbitrary row: a document holds a draft
  // and a published copy per locale, and any of them can be missing the field
  // we came here for. Taking the first row and reading it for all four fields
  // meant one sibling with a null slug was enough to copy nothing at all, even
  // though another row two places down had the value.
  const siblings = await strapi.db.query('api::news-post.news-post').findMany({
    where: { documentId: data.documentId },
    select: ['slug', 'published_date', 'event_date', 'event_end_date'],
  });
  if (siblings.length === 0) return;

  const sharedValue = (field: keyof (typeof siblings)[number]) =>
    siblings.find((sibling) => sibling[field] != null)?.[field];

  if (needsSlug) data.slug = sharedValue('slug') ?? data.slug;
  if (needsPublishedDate) data.published_date = sharedValue('published_date') ?? data.published_date;
  if (needsEventDate) data.event_date = sharedValue('event_date') ?? data.event_date;
  if (needsEventEndDate) data.event_end_date = sharedValue('event_end_date') ?? data.event_end_date;
}

/**
 * True when the write actually carries tags, whatever shape the layer above
 * handed down: a plain array of ids, or the relation payload the document
 * service builds from the admin form. Anything empty counts as "no tags", and
 * only then do we fill them in - an editor who deliberately picked a different
 * set on the second locale must never be overwritten.
 */
function carriesTags(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    const rel = value as { set?: unknown[]; connect?: unknown[] };
    if (Array.isArray(rel.set)) return rel.set.length > 0;
    if (Array.isArray(rel.connect)) return rel.connect.length > 0;
  }
  return false;
}

/**
 * Carry the tags over when a second locale of a post is written without any.
 *
 * Tag is a localized content-type, so one tag is two rows - "academic" exists
 * once in Thai and once in English with different ids. That is why Strapi
 * cannot share the relation itself even though `tags` is declared
 * non-localized: the rows it would point at genuinely differ per locale.
 *
 * The pairing therefore goes through Tag's `key` (announcements / cfp /
 * academic / training / article), which is non-localized and so identical on
 * both sides. Matching on the translated `name` would break the moment someone
 * edits a label.
 */
async function shareTagsAcrossLocales(event: LifecycleEvent) {
  const { data, where } = event.params;

  if (!data.documentId) return;
  if (carriesTags(data.tags)) return;

  // On create the locale rides along with the data; on update it does not, so
  // fall back to the row being written.
  let locale = data.locale ?? null;
  if (!locale && where?.id) {
    const current = await strapi.db
      .query('api::news-post.news-post')
      .findOne({ where: { id: where.id }, select: ['locale'] });
    locale = current?.locale ?? null;
  }
  if (!locale) return;

  const siblings = await strapi.db.query('api::news-post.news-post').findMany({
    where: { documentId: data.documentId },
    populate: { tags: true },
  });

  const keys = new Set<string>();
  for (const sibling of siblings) {
    for (const tag of sibling.tags ?? []) {
      if (tag?.key) keys.add(tag.key);
    }
  }
  if (keys.size === 0) return;

  const matching = await strapi.db.query('api::tag.tag').findMany({
    where: { key: { $in: [...keys] }, locale },
    select: ['id'],
  });

  // A key with no counterpart in this locale is simply skipped - a missing tag
  // must not be invented, and must never fail the save.
  if (matching.length > 0) data.tags = matching.map((tag) => tag.id);
}

/**
 * The front end builds every link to a post from its slug, so an entry saved
 * without one lands on the site unreachable and takes the localized list page
 * with it.
 *
 * This is a hook rather than `required: true` on the schema, for two reasons
 * that are easy to rediscover the hard way:
 *
 * - Schema validation runs *before* these hooks, so marking the field required
 *   rejects a second locale outright — and a second locale arrives with no slug
 *   precisely because shareNonLocalizedFields is about to copy one from its
 *   sibling. Tried it; it breaks adding an English version of a Thai post.
 * - It only binds the admin form anyway. A create through the Document Service
 *   — a script, an importer, the REST API — stores `slug: null` regardless.
 *
 * Checking here, after the copy, covers every path into the table and still
 * lets inheritance do its job.
 */
function requireSlug(data: LifecycleEvent['params']['data']) {
  if (typeof data.slug === 'string' && data.slug.trim() !== '') return;

  throw new errors.ValidationError(
    'A news post needs a slug. The front end builds every link to the post from ' +
      'it, so an entry saved without one is unreachable on the site.'
  );
}

export default {
  async beforeCreate(event: LifecycleEvent) {
    await shareNonLocalizedFields(event);
    await shareTagsAcrossLocales(event);
    // Default the post date to today for a brand-new post whose editor left it
    // blank (and no sibling locale supplied one). It's a date-only field, and
    // stays editable so migrated content can be back-dated to its old-site date.
    if (!event.params.data.published_date) {
      event.params.data.published_date = new Date().toISOString().slice(0, 10);
    }
    requireSlug(event.params.data);
  },
  async beforeUpdate(event: LifecycleEvent) {
    await shareNonLocalizedFields(event);
    await shareTagsAcrossLocales(event);
    // Only when the write actually carries a slug: a partial update that never
    // mentions the field must not be judged on a value it isn't setting.
    if ('slug' in event.params.data) requireSlug(event.params.data);
  },
};
