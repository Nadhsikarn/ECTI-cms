// Lifecycle hooks for the Conference content-type.
// - order: auto-incremented (max existing order + 1) when left empty on create.

type LifecycleEvent = {
  params: {
    data: {
      order?: number | null;
    };
  };
};

async function autoIncrementOrder(event: LifecycleEvent) {
  const { data } = event.params;

  // Respect an explicit value (including values copied across i18n locales).
  if (data.order !== undefined && data.order !== null) return;

  const [last] = await strapi.db.query('api::conference.conference').findMany({
    orderBy: { order: 'desc' },
    limit: 1,
  });

  const maxOrder = typeof last?.order === 'number' ? last.order : 0;
  data.order = maxOrder + 1;
}

export default {
  async beforeCreate(event: LifecycleEvent) {
    await autoIncrementOrder(event);
  },
};
