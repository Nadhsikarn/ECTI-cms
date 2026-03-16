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

export interface UiButtonItem extends Struct.ComponentSchema {
  collectionName: 'components_ui_button_items';
  info: {
    displayName: 'button_item';
  };
  attributes: {
    label: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<['primary', 'secondary', 'link']>;
    url: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'deadline.deadline-item': DeadlineDeadlineItem;
      'ui.button-item': UiButtonItem;
    }
  }
}
