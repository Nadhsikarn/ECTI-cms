// Lifecycle hooks for the Journal content-type.
// - order: auto-incremented (max existing order + 1) when left empty on create.
// - published_date: auto-stamped with the publish time when an entry is published.

type LifecycleEvent = {
  params: {
    data: {
      order?: number | null;
      publishedAt?: string | Date | null;
      published_date?: string | Date | null;
    };
  };
};

async function autoIncrementOrder(event: LifecycleEvent) {
  const { data } = event.params;

  // Respect an explicit value (including values copied across i18n locales).
  if (data.order !== undefined && data.order !== null) return;

  const [last] = await strapi.db.query('api::journal.journal').findMany({
    orderBy: { order: 'desc' },
    limit: 1,
  });

  const maxOrder = typeof last?.order === 'number' ? last.order : 0;
  data.order = maxOrder + 1;
}

function stampPublishedDate(event: LifecycleEvent) {
  const { data } = event.params;

  // When publishing, Strapi sets publishedAt. Mirror it onto published_date
  // unless an explicit value was provided in the same operation.
  if (data.publishedAt && (data.published_date === undefined || data.published_date === null)) {
    data.published_date = data.publishedAt;
  }
}

export default {
  async beforeCreate(event: LifecycleEvent) {
    await autoIncrementOrder(event);
    stampPublishedDate(event);
  },
  async beforeUpdate(event: LifecycleEvent) {
    stampPublishedDate(event);
  },
};
