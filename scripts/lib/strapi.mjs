/**
 * The bits of talking to Strapi that both importers need.
 *
 * Pulled out when the conference import turned out to want the same request
 * helper and the same "what is already there" check as the news one. Two copies
 * of a skip check is how a re-run quietly starts creating duplicates in one
 * importer and not the other.
 */

/**
 * The API lives at the server root; /admin is the panel a person logs into.
 *
 * They get confused because the URL anyone has to hand is the one open in their
 * browser, which is the admin. Pasting that produces requests to
 * /admin/api/news-posts, which Strapi answers with the panel's HTML — and the
 * only symptom is `Unexpected token '<'` from JSON.parse, several layers away
 * from the setting that caused it. Trimming it costs a line.
 */
function normaliseUrl(raw) {
  const trimmed = raw.replace(/\/+$/, "");
  const withoutAdmin = trimmed.replace(/\/admin$/, "");
  if (withoutAdmin !== trimmed) {
    console.warn(`Note: dropped /admin from STRAPI_URL — using ${withoutAdmin}\n`);
  }
  return withoutAdmin;
}

const STRAPI_URL = normaliseUrl(process.env.STRAPI_URL || "http://localhost:1337");
const TOKEN = process.env.STRAPI_API_TOKEN?.trim();

export { STRAPI_URL };

export function requireToken() {
  if (!TOKEN) throw new Error("STRAPI_API_TOKEN is not set.");
}

/** Long enough for an upload Strapi still has to derive thumbnails from. */
const REQUEST_TIMEOUT_MS = 120_000;
const ATTEMPTS = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Whether a failure is worth trying again.
 *
 * Uploading the news archive knocked Strapi Cloud over: every image it accepts
 * is resized into several formats, and sixty posts of them back to back was
 * more than the instance could take. It stopped answering, and because nothing
 * here retried, the remaining 55 posts each failed once and were abandoned —
 * a run that reported 5 of 60 against a CMS that was fine again minutes later.
 *
 * A refusal is different from a rejection. 4xx means Strapi read the request
 * and said no, and asking again changes nothing; a socket error, a timeout, or
 * a 5xx means it never got to answer.
 */
function worthRetrying(err, status) {
  if (status === undefined) return true; // fetch threw: no answer at all
  return status === 429 || status >= 500;
}

export async function api(path, options = {}) {
  let res;

  for (let attempt = 1; ; attempt += 1) {
    try {
      res = await fetch(`${STRAPI_URL}${path}`, {
        ...options,
        headers: {
          authorization: `Bearer ${TOKEN}`,
          ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
          ...options.headers,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok || !worthRetrying(null, res.status) || attempt === ATTEMPTS) break;
    } catch (err) {
      if (!worthRetrying(err) || attempt === ATTEMPTS) {
        // Say which end went quiet. "fetch failed" on its own sent us looking
        // at the old WordPress site for a fault that was Strapi's.
        throw new Error(
          `${options.method ?? "GET"} ${path} → no answer from ${STRAPI_URL} ` +
            `after ${attempt} attempts: ${err.message}`
        );
      }
    }

    // Backs off to give an instance that is struggling room to recover:
    // 2s, 6s, 18s. Enough for a restart, short enough to sit through.
    const wait = 2000 * 3 ** (attempt - 1);
    console.warn(`  … ${path.split("?")[0]} failed, retrying in ${wait / 1000}s`);
    await sleep(wait);
  }

  const text = await res.text();

  // An HTML answer means the request never reached the content API — a wrong
  // STRAPI_URL, or a proxy in the way. Saying so beats `Unexpected token '<'`,
  // which names the symptom and hides the cause.
  if (text.trimStart().startsWith("<")) {
    throw new Error(
      `${options.method ?? "GET"} ${path} → HTML instead of JSON (HTTP ${res.status}).\n` +
        `  Asked: ${STRAPI_URL}${path}\n` +
        `  STRAPI_URL should be the server root, with no /admin and no path.`
    );
  }

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `${options.method ?? "GET"} ${path} → HTTP ${res.status}, unreadable body: ${text.slice(0, 200)}`
    );
  }

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
