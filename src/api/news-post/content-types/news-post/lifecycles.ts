// Lifecycle hooks for the News Post content-type.
// - slug: shared across i18n locales. `slug` is a non-localized uid, but Strapi
//   does not propagate uid values to secondary-locale entries, so a new locale
//   (e.g. the English version of a Thai post) is created with slug = null. The
//   front-end keys/links on slug, so a null slug breaks the localized list page.
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

  const [sibling] = await strapi.db.query('api::news-post.news-post').findMany({
    where: { documentId: data.documentId, slug: { $notNull: true } },
    limit: 1,
  });

  if (sibling?.slug) data.slug = sibling.slug;
}

export default {
  async beforeCreate(event: LifecycleEvent) {
    await shareSlugAcrossLocales(event);
  },
  async beforeUpdate(event: LifecycleEvent) {
    await shareSlugAcrossLocales(event);
  },
};
