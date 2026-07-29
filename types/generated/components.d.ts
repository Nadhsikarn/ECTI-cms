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

export interface GuideGuideStep extends Struct.ComponentSchema {
  collectionName: 'components_guide_guide_steps';
  info: {
    description: 'One item a member must attach for a reimbursement / loan case. Set documentKey to the `key` of an Association Document (e.g. reimbursement-form) to turn the step into a download link.';
    displayName: 'guide step';
  };
  attributes: {
    documentKey: Schema.Attribute.String;
    note: Schema.Attribute.String;
    text: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface UiAttachment extends Struct.ComponentSchema {
  collectionName: 'components_ui_attachments';
  info: {
    description: 'A downloadable document (title + uploaded file, or an external link fallback).';
    displayName: 'attachment';
  };
  attributes: {
    file: Schema.Attribute.Media<'files' | 'images'>;
    link: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
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
      'guide.guide-step': GuideGuideStep;
      'ui.attachment': UiAttachment;
      'ui.button-item': UiButtonItem;
    }
  }
}
