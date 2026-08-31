import { errors } from '@strapi/utils';

// Lifecycle hooks for the Activity (event) content-type.
// - slug: shared across i18n locales. `slug` is a non-localized uid, but Strapi
//   does not propagate uid values to secondary-locale entries, so a new locale
//   (e.g. the English version of a Thai activity) is created with slug = null.
//   The front-end links on slug, so a null slug breaks the localized event pages.
//   Here we copy the slug from any sibling locale of the same document when the
//   entry being written has none.

type LifecycleEvent = {
  params: {
    data: {
      documentId?: string | null;
      slug?: string | null;
    };
  };
};

async function shareSlugAcrossLocales(event: LifecycleEvent) {
  const { data } = event.params;

  // Respect an explicit slug (the default locale, or a value already set).
  if (data.slug) return;

  // Need the document to locate its other-locale siblings.
  if (!data.documentId) return;

  const [sibling] = await strapi.db.query('api::activity.activity').findMany({
    where: { documentId: data.documentId, slug: { $notNull: true } },
    limit: 1,
  });

  if (sibling?.slug) data.slug = sibling.slug;
}

/**
 * The front end builds every event link from the slug, so an activity saved
 * without one is unreachable on the site.
 *
 * This is a hook rather than `required: true` on the schema, for two reasons
 * that are easy to rediscover the hard way:
 *
 * - Schema validation runs *before* these hooks, so marking the field required
 *   rejects a second locale outright — and a second locale arrives with no slug
 *   precisely because shareSlugAcrossLocales is about to copy one from its
 *   sibling. Tried it; it breaks adding an English version of a Thai activity.
 * - It only binds the admin form anyway. A create through the Document Service
 *   — a script, an importer, the REST API — stores `slug: null` regardless.
 *
 * Checking here, after the copy, covers every path in and still lets
 * inheritance do its job.
 */
function requireSlug(data: LifecycleEvent['params']['data']) {
  if (typeof data.slug === 'string' && data.slug.trim() !== '') return;

  throw new errors.ValidationError(
    'An activity needs a slug. The front end builds every link to the event ' +
      'from it, so an entry saved without one is unreachable on the site.'
  );
}

export default {
  async beforeCreate(event: LifecycleEvent) {
    await shareSlugAcrossLocales(event);
    requireSlug(event.params.data);
  },
  async beforeUpdate(event: LifecycleEvent) {
    await shareSlugAcrossLocales(event);
    // Only when the write actually carries a slug: a partial update that never
    // mentions the field must not be judged on a value it isn't setting.
    if ('slug' in event.params.data) requireSlug(event.params.data);
  },
};
