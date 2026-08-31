import type { Core } from '@strapi/strapi';

/**
 * Strapi answers `?status=draft` on the content API with the same `find`
 * permission that serves published entries. `enablePublicPermissions` in
 * `src/index.ts` grants that permission to the public role for every type the
 * front reads, so without this middleware an unauthenticated caller can read
 * everything an editor has not published yet by appending one parameter.
 *
 * What that leaks is editorial timing rather than secrets — an unannounced
 * result, a schedule still being confirmed — but those are exactly the things
 * the association decides when to publish.
 *
 * The admin panel is unaffected: it talks to `/content-manager/`, not `/api/`,
 * with its own session. Nothing an editor does depends on this parameter.
 *
 * A request carrying an Authorization header keeps it. API tokens are
 * deliberate grants — the importers in `scripts/` use one — and handing out or
 * revoking a token is a separate, visible act.
 */

// v5 spells it `status`. `publicationState` is the v4 name, stripped as well so
// an older client cannot reach drafts through the older spelling.
const DRAFT_SELECTORS = new Set(['status', 'publicationstate']);

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx, next) => {
    if (!ctx.path.startsWith('/api/') || ctx.request.header.authorization) {
      return next();
    }

    // Rewriting the raw querystring rather than deleting keys off `ctx.query`:
    // the parsed object is memoised, and reassigning the string is what
    // invalidates it. Doing it here also covers a repeated
    // `?status=published&status=draft`, since every copy of the key goes.
    const params = new URLSearchParams(ctx.querystring);
    let removed = false;

    for (const key of [...params.keys()]) {
      if (DRAFT_SELECTORS.has(key.toLowerCase())) {
        params.delete(key);
        removed = true;
      }
    }

    if (removed) {
      ctx.querystring = params.toString();
      strapi.log.debug(
        `[public-api] dropped a draft selector from an unauthenticated ${ctx.method} ${ctx.path}`
      );
    }

    return next();
  };
};
