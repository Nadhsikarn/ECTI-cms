/**
 * Checks that tags carry over to a second locale, against a real Strapi and a
 * real database - the relation shapes the document service hands to a lifecycle
 * are not something to guess at.
 *
 * Run after `pnpm build`:  node scripts/test-tag-sharing.cjs
 *
 * Every post it creates is deleted again at the end, pass or fail.
 */
const { createStrapi } = require('@strapi/strapi');

const UID = 'api::news-post.news-post';
const TAG_UID = 'api::tag.tag';

const created = [];
let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ''}`);
  }
}

async function tagKeys(strapi, documentId, locale) {
  const doc = await strapi.documents(UID).findOne({
    documentId,
    locale,
    populate: { tags: true },
  });
  return (doc?.tags ?? []).map((t) => t.key).sort();
}

async function main() {
  const strapi = await createStrapi({ distDir: 'dist' }).load();

  try {
    const th = await strapi.documents(TAG_UID).findMany({ locale: 'th' });
    const en = await strapi.documents(TAG_UID).findMany({ locale: 'en' });
    console.log(`tags: th=${th.length} en=${en.length}`);

    const byKeyTh = Object.fromEntries(th.map((t) => [t.key, t]));
    const byKeyEn = Object.fromEntries(en.map((t) => [t.key, t]));
    const KEY_A = 'academic';
    const KEY_B = 'cfp';

    // --- 1. th first, then en with no tags -------------------------------
    const a = await strapi.documents(UID).create({
      locale: 'th',
      data: {
        title: 'ทดสอบแท็ก ไทยก่อน',
        slug: `tag-test-th-first-${Date.now()}`,
        tags: [byKeyTh[KEY_A].id],
      },
    });
    created.push(a.documentId);
    await strapi.documents(UID).update({
      documentId: a.documentId,
      locale: 'en',
      data: { title: 'Tag test, Thai first' },
    });
    check(
      'th -> en: tag carried over',
      JSON.stringify(await tagKeys(strapi, a.documentId, 'en')) === JSON.stringify([KEY_A]),
      JSON.stringify(await tagKeys(strapi, a.documentId, 'en'))
    );

    // --- 2. en first, then th with no tags -------------------------------
    const b = await strapi.documents(UID).create({
      locale: 'en',
      data: {
        title: 'Tag test, English first',
        slug: `tag-test-en-first-${Date.now()}`,
        tags: [byKeyEn[KEY_B].id],
      },
    });
    created.push(b.documentId);
    await strapi.documents(UID).update({
      documentId: b.documentId,
      locale: 'th',
      data: { title: 'ทดสอบแท็ก อังกฤษก่อน' },
    });
    check(
      'en -> th: tag carried over',
      JSON.stringify(await tagKeys(strapi, b.documentId, 'th')) === JSON.stringify([KEY_B]),
      JSON.stringify(await tagKeys(strapi, b.documentId, 'th'))
    );

    // --- 3. second locale picks its own tags: must not be overwritten ----
    const c = await strapi.documents(UID).create({
      locale: 'th',
      data: {
        title: 'ทดสอบแท็ก เลือกเอง',
        slug: `tag-test-explicit-${Date.now()}`,
        tags: [byKeyTh[KEY_A].id],
      },
    });
    created.push(c.documentId);
    await strapi.documents(UID).update({
      documentId: c.documentId,
      locale: 'en',
      data: { title: 'Tag test, own choice', tags: [byKeyEn[KEY_B].id] },
    });
    check(
      'explicit tags on 2nd locale survive',
      JSON.stringify(await tagKeys(strapi, c.documentId, 'en')) === JSON.stringify([KEY_B]),
      JSON.stringify(await tagKeys(strapi, c.documentId, 'en'))
    );

    // --- 4. editing an existing post must not change its tags -----------
    const beforeEdit = await tagKeys(strapi, a.documentId, 'th');
    await strapi.documents(UID).update({
      documentId: a.documentId,
      locale: 'th',
      data: { summary: 'แก้ข้อความเฉย ๆ' },
    });
    const afterEdit = await tagKeys(strapi, a.documentId, 'th');
    check(
      'editing text leaves tags alone',
      JSON.stringify(beforeEdit) === JSON.stringify(afterEdit),
      `${JSON.stringify(beforeEdit)} -> ${JSON.stringify(afterEdit)}`
    );

    // --- 5. a post with no tags anywhere stays untagged ------------------
    const d = await strapi.documents(UID).create({
      locale: 'th',
      data: { title: 'ทดสอบแท็ก ไม่มีแท็ก', slug: `tag-test-none-${Date.now()}` },
    });
    created.push(d.documentId);
    await strapi.documents(UID).update({
      documentId: d.documentId,
      locale: 'en',
      data: { title: 'Tag test, no tags' },
    });
    check(
      'no tags anywhere stays empty',
      (await tagKeys(strapi, d.documentId, 'en')).length === 0
    );
  } finally {
    for (const documentId of created) {
      await strapi.documents(UID).delete({ documentId }).catch(() => {});
    }
    console.log(`\ncleaned up ${created.length} test posts`);
    console.log(`pass=${pass} fail=${fail}`);
    await strapi.destroy();
    process.exit(fail === 0 ? 0 : 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
