import type { Schema, Struct } from '@strapi/strapi';

export interface AboutAboutCard extends Struct.ComponentSchema {
  collectionName: 'components_about_about_cards';
  info: {
    displayName: 'about_card';
  };
  attributes: {
    description: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface AboutObjectiveItem extends Struct.ComponentSchema {
  collectionName: 'components_about_objective_items';
  info: {
    displayName: 'objective_item';
  };
  attributes: {
    text: Schema.Attribute.Text;
  };
}

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
    type: Schema.Attribute.Enumeration<['primary', 'secondary', 'link']>;
    url: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'about.about-card': AboutAboutCard;
      'about.objective-item': AboutObjectiveItem;
      'deadline.deadline-item': DeadlineDeadlineItem;
      'ui.button-item': UiButtonItem;
    }
  }
}
