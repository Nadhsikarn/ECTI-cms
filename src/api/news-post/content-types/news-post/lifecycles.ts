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
      slug?: string | null;
      published_date?: string | null;
      event_date?: string | null;
      event_end_date?: string | null;
    };
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

  const [sibling] = await strapi.db.query('api::news-post.news-post').findMany({
    where: { documentId: data.documentId },
    limit: 1,
  });
  if (!sibling) return;

  if (needsSlug && sibling.slug) data.slug = sibling.slug;
  if (needsPublishedDate && sibling.published_date) data.published_date = sibling.published_date;
  if (needsEventDate && sibling.event_date) data.event_date = sibling.event_date;
  if (needsEventEndDate && sibling.event_end_date) data.event_end_date = sibling.event_end_date;
}

export default {
  async beforeCreate(event: LifecycleEvent) {
    await shareNonLocalizedFields(event);
    // Default the post date to today for a brand-new post whose editor left it
    // blank (and no sibling locale supplied one). It's a date-only field, and
    // stays editable so migrated content can be back-dated to its old-site date.
    if (!event.params.data.published_date) {
      event.params.data.published_date = new Date().toISOString().slice(0, 10);
    }
  },
  async beforeUpdate(event: LifecycleEvent) {
    await shareNonLocalizedFields(event);
  },
};
