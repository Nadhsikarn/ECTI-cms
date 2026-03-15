import type { Schema, Struct } from '@strapi/strapi';

export interface DeadlineDeadlineItem extends Struct.ComponentSchema {
  collectionName: 'components_deadline_deadline_items';
  info: {
    displayName: 'deadline_item';
  };
  attributes: {
    date: Schema.Attribute.Date;
    title: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'deadline.deadline-item': DeadlineDeadlineItem;
    }
  }
}
