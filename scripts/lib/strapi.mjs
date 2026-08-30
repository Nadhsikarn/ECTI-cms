/**
 * The bits of talking to Strapi that both importers need.
 *
 * Pulled out when the conference import turned out to want the same request
 * helper and the same "what is already there" check as the news one. Two copies
 * of a skip check is how a re-run quietly starts creating duplicates in one
 * importer and not the other.
 */

const STRAPI_URL = (process.env.STRAPI_URL || "http://localhost:1337").replace(/\/+$/, "");
const TOKEN = process.env.STRAPI_API_TOKEN?.trim();

export { STRAPI_URL };

export function requireToken() {
  if (!TOKEN) throw new Error("STRAPI_API_TOKEN is not set.");
}

export async function api(path, options = {}) {
  const res = await fetch(`${STRAPI_URL}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...options.headers,
    },
    signal: AbortSignal.timeout(60_000),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    // Strapi puts the useful part in details.errors — the top-level message is
    // only ever "N errors occurred", which names neither the field nor the rule.
    const fields = data?.error?.details?.errors
      ?.map((e) => e.message)
      .slice(0, 5)
      .join("; ");
    const detail = fields || data?.error?.message || text.slice(0, 300);
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${detail}`);
  }
  return data;
}

/**
 * Every slug already in a collection, drafts included.
 *
 * `status=draft` is what returns them all: in Strapi 5 every document has a
 * draft version, so this is a superset of the published ones. Asking only for
 * published entries would miss anything imported by an earlier run and not yet
 * reviewed — and then import it a second time.
 */
export async function existingSlugs(collection) {
  const slugs = new Set();
  for (let page = 1; ; page += 1) {
    const res = await api(
      `/api/${collection}?status=draft&locale=th&fields[0]=slug` +
        `&pagination[page]=${page}&pagination[pageSize]=100`
    );
    for (const entry of res.data) if (entry.slug) slugs.add(entry.slug);
    if (page >= (res.meta?.pagination?.pageCount ?? 1)) break;
  }
  return slugs;
}

/**
 * Creates the document in Thai, then adds the English localisation.
 *
 * Both carry the same content. Nothing in the legacy archive is translated, and
 * putting each entry in only the locale it happens to be written in would hide
 * most of it from whichever language a reader picked.
 *
 * `slug` is repeated in the second call on purpose: it is a non-localized uid
 * and Strapi does not propagate those across locales, so leaving it out leaves
 * the English URL unresolvable. src/seed.ts carries the same note.
 */
export async function createInBothLocales(collection, data, { draft = false } = {}) {
  // A plain POST to the content API publishes. That is worth stating because it
  // is the opposite of what everything here used to claim: Strapi 5 stamps
  // publishedAt on create unless you ask for a draft, so an import that says
  // nothing about status puts every entry straight on the live site.
  //
  // Verified against 5.52.2 rather than assumed — POST with no status came back
  // published and was readable with no token at all, POST with status=draft came
  // back with publishedAt null and invisible to an anonymous reader.
  const status = draft ? "&status=draft" : "";

  const created = await api(`/api/${collection}?locale=th${status}`, {
    method: "POST",
    body: JSON.stringify({ data }),
  });

  const { documentId } = created.data;

  // A PUT on the same document, not a second POST — a POST would make a
  // separate entry rather than a translation of this one. Same status as the
  // Thai version, or the English half of a document goes live while the Thai
  // half waits for review.
  await api(`/api/${collection}/${documentId}?locale=en${status}`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });

  return documentId;
}
