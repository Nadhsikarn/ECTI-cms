import type { Core } from '@strapi/strapi';

/**
 * Origins allowed to call this API from a browser, from CORS_ORIGINS
 * (comma-separated). Strapi's default is `*`, which lets any page on the
 * internet read the API with the visitor's browser — harmless for the public
 * content itself, less so given the admin panel answers on this same origin.
 *
 * Left empty the default stands, so a dev machine and a fresh deploy keep
 * working; production should set the variable.
 */
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: corsOrigins.length > 0 ? corsOrigins : ['*'],
      // The front reads content and nothing else; there is no browser-side
      // write path to this API.
      methods: ['GET', 'HEAD', 'OPTIONS'],
    },
  },
  'strapi::poweredBy',
  // Ahead of strapi::query on purpose: it edits the raw querystring, so the
  // parse that follows never sees the parameter it removed.
  'global::public-published-only',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
