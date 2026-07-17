// @ts-nocheck
import type { Core } from '@strapi/strapi';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

async function countDocuments(strapi: Core.Strapi, uid: Parameters<Core.Strapi['documents']>[0]) {
  const result = await strapi.documents(uid).findMany({ locale: 'th' });
  return result.length;
}

export async function seed(strapi: Core.Strapi) {
  strapi.log.info('[seed] Checking CMS data...');

  await seedTags(strapi);
  await seedNewsPosts(strapi);
  await seedBoardMembers(strapi);
  await seedMilestones(strapi);
  await seedMissionVision(strapi);
  await seedObjectives(strapi);
  await seedActivities(strapi);
  await seedBenefits(strapi);
  await seedMemberTypes(strapi);
  await seedHowToJoins(strapi);
  await seedQuestions(strapi);
  await seedResources(strapi);
  await seedJournals(strapi);
  await seedConferences(strapi);
  await seedContact(strapi);
  await seedSocialLinks(strapi);
  await seedMembershipApply(strapi);
  await seedMembershipPayment(strapi);
  await seedMembershipCredit(strapi);
  await seedMembershipDocuments(strapi);

  strapi.log.info('[seed] Done.');
}

// ─── Tags ────────────────────────────────────────────────────────────────────

async function seedTags(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::tag.tag') > 0) return;

  const tags = [
    { key: 'announcements', th: 'ประกาศ', en: 'Announcements' },
    { key: 'cfp', th: 'เรียกรับบทความ', en: 'Call for Papers' },
    { key: 'academic', th: 'กิจกรรมวิชาการ', en: 'Academic Events' },
    { key: 'training', th: 'อบรม', en: 'Training' },
    { key: 'article', th: 'บทความ', en: 'Article' },
  ];

  for (const t of tags) {
    const doc = await strapi.documents('api::tag.tag').create({
      data: { name: t.th, key: t.key as any },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::tag.tag').update({
      documentId: doc.documentId,
      data: { name: t.en },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Tags created');
}

// Resolve tag documentIds from their stable keys (used to link news posts).
async function getTagIdsByKeys(strapi: Core.Strapi, keys: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const key of keys) {
    const tag = await (strapi.documents('api::tag.tag') as any).findFirst({
      filters: { key: { $eq: key } },
      locale: 'th',
    });
    if (tag?.documentId) ids.push(tag.documentId);
  }
  return ids;
}

// ─── News Posts ──────────────────────────────────────────────────────────────

async function seedNewsPosts(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::news-post.news-post') > 0) return;

  const posts = [
    {
      slug: 'ecti-con-2026-cfp',
      th: {
        title: 'เปิดรับบทความ ECTI-CON 2026',
        summary: 'สมาคม ECTI เปิดรับบทความวิจัยสำหรับการประชุมวิชาการนานาชาติ ECTI-CON 2026 ณ จ.เชียงใหม่',
        body: [{ type: 'paragraph', children: [{ type: 'text', text: 'ECTI-CON 2026 เปิดรับบทความวิจัยในสาขาวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคม และสารสนเทศ กำหนดส่ง 30 เมษายน 2569' }] }],
      },
      en: {
        title: 'ECTI-CON 2026 Call for Papers Now Open',
        summary: 'ECTI Association invites high-quality research papers for ECTI-CON 2026 in Chiang Mai.',
        body: [{ type: 'paragraph', children: [{ type: 'text', text: 'ECTI-CON 2026 welcomes papers in Electrical Engineering, Electronics, Computer Science, Telecommunications, and IT. Submission deadline: April 30, 2026.' }] }],
      },
      author: 'ECTI Secretariat',
      read_time_min: 3,
      tags: ['cfp', 'announcements'],
    },
    {
      slug: 'ecti-award-2025-winners',
      th: {
        title: 'ประกาศรายชื่อผู้ได้รับรางวัล ECTI ประจำปี 2568',
        summary: 'สมาคม ECTI ขอแสดงความยินดีกับนักวิจัยและนักวิชาการที่ได้รับรางวัลเกียรติยศประจำปี 2568',
        body: [{ type: 'paragraph', children: [{ type: 'text', text: 'สมาคม ECTI ประกาศรายชื่อผู้ได้รับรางวัลประจำปี 2568 ในงาน ECTI Annual Award Ceremony ณ กรุงเทพมหานคร' }] }],
      },
      en: {
        title: 'ECTI Annual Award 2025 Winners Announced',
        summary: 'ECTI Association congratulates the researchers and academics who received the prestigious ECTI Annual Awards 2025.',
        body: [{ type: 'paragraph', children: [{ type: 'text', text: 'ECTI Association announces the 2025 award recipients at the ECTI Annual Award Ceremony in Bangkok.' }] }],
      },
      author: 'ECTI Secretariat',
      read_time_min: 2,
      tags: ['announcements'],
    },
    {
      slug: 'ecti-transactions-special-issue',
      th: {
        title: 'วารสาร ECTI-CIT เปิดรับบทความฉบับพิเศษ AI & IoT',
        summary: 'วารสาร ECTI Transactions on Computer and Information Technology เปิดรับบทความสำหรับฉบับพิเศษด้าน AI และ IoT',
        body: [{ type: 'paragraph', children: [{ type: 'text', text: 'วารสาร ECTI-CIT ฉบับพิเศษเรื่อง Artificial Intelligence and Internet of Things เปิดรับบทความวิจัยจนถึงวันที่ 31 มีนาคม 2569' }] }],
      },
      en: {
        title: 'ECTI-CIT Special Issue on AI & IoT Open for Submissions',
        summary: 'ECTI Transactions on Computer and Information Technology opens a special issue on AI and IoT research.',
        body: [{ type: 'paragraph', children: [{ type: 'text', text: 'The ECTI-CIT special issue on Artificial Intelligence and Internet of Things is open for submissions until March 31, 2026.' }] }],
      },
      author: 'ECTI Editorial Board',
      read_time_min: 4,
      tags: ['cfp'],
    },
  ];

  for (const p of posts) {
    const tagIds = await getTagIdsByKeys(strapi, p.tags);
    const doc = await strapi.documents('api::news-post.news-post').create({
      data: { slug: p.slug, title: p.th.title, summary: p.th.summary, body: p.th.body, author: p.author, read_time_min: p.read_time_min, tags: tagIds },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::news-post.news-post').update({
      documentId: doc.documentId,
      // slug is a non-localized uid; Strapi does not carry it to the en locale
      // automatically, so set it explicitly to keep the localized URL working.
      data: { slug: p.slug, title: p.en.title, summary: p.en.summary, body: p.en.body },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] News posts created');
}

// ─── Board Members ───────────────────────────────────────────────────────────

// Real 2026-2027 board from https://ecti-thailand.org/committee/. Two fixes vs
// the old site: EN name of the Bio-Medical chair (old site pasted another
// person's name) and "Receptionist" → "Industry Relations" for อุตสาหกรรมสัมพันธ์.
const BOARD_TERM = '2026-2027';
const BOARD_IMAGE_BASE = 'https://ecti-thailand.org/wp-content/uploads/2026/04/';

// Photos live on the old WP site; fetch once and upload into the media library.
// A failed download must not block seeding — the member is created without a
// photo and an editor can attach one in the admin later.
async function uploadRemoteImage(strapi: Core.Strapi, url: string, name: string) {
  try {
    // Timeout so a hung old-site connection can't stall bootstrap (and fail
    // the whole deploy on Strapi Cloud); content-type guard so a WP error page
    // served with HTTP 200 doesn't end up in the media library as a "photo".
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) throw new Error(`not an image: ${contentType}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const tmp = path.join(os.tmpdir(), `ecti-seed-${name}`);
    await fs.writeFile(tmp, buf);
    try {
      const [file] = await strapi.plugin('upload').service('upload').upload({
        data: { fileInfo: { name } },
        files: { filepath: tmp, originalFilename: name, mimetype: 'image/jpeg', size: buf.length },
      });
      return file?.id ?? null;
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  } catch (err) {
    strapi.log.warn(`[seed] Board photo skipped (${name}): ${err?.stack || err}`);
    return null;
  }
}

async function seedBoardMembers(strapi: Core.Strapi) {
  const uid = 'api::board-member.board-member';

  // Names of the pre-term mock seed data, used by the cleanup below. Both
  // locales listed: th and en are separate rows.
  const MOCK_NAMES = [
    'ศ.ดร. สมชาย วิทยากร', 'Prof. Dr. Somchai Wittayakorn',
    'รศ.ดร. สุนีย์ รัตนวงศ์', 'Assoc. Prof. Dr. Sunee Rattanawong',
    'ผศ.ดร. ประวิทย์ ชัยสกุล', 'Asst. Prof. Dr. Prawit Chaisakul',
    'รศ.ดร. อนุชา ทองเจริญ', 'Assoc. Prof. Dr. Anucha Thongcharoen',
    'ศ.ดร. วีระ สุขประเสริฐ', 'Prof. Dr. Veera Sukprasert',
    'รศ.ดร. ชาญณรงค์ พรรุ่งโรจน์', 'Assoc. Prof. Dr. Channarong Pornrungrojn',
    'ผศ.ดร. ภาวิณี ศรีสุข', 'Asst. Prof. Dr. Pawinee Srisuk',
    'ศ.ดร. ธีระ อภิวัฒน์กุล', 'Prof. Dr. Theera Apivatanakul',
    'รศ.ดร. นลินรัตน์ กิตติวงศ์', 'Assoc. Prof. Dr. Nalinrat Kittiwong',
  ];

  const members = [
    { th: { name: 'รศ. ดร.อนันต์ ผลเพิ่ม', role: 'นายกสมาคม', institution: 'มหาวิทยาลัยเกษตรศาสตร์' }, en: { name: 'Assoc. Prof. Dr. Anan Phonphoem', role: 'ECTI President', institution: 'Kasetsart University' }, image: 'Anan-2.jpg' },
    { th: { name: 'ศ. ดร.พรชัย ทรัพย์นิธิ', role: 'อุปนายก', institution: 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง' }, en: { name: 'Prof. Dr. Pornchai Supnithi', role: 'Vice President', institution: "King Mongkut's Institute of Technology Ladkrabang" }, image: 'Pornchai.jpg' },
    { th: { name: 'ผศ. ดร.กิตติพล โหราพงศ์', role: 'นายทะเบียน', institution: 'มหาวิทยาลัยเกษตรศาสตร์' }, en: { name: 'Asst. Prof. Dr. Kittipol Horapong', role: 'Registrar', institution: 'Kasetsart University' }, image: 'Kittipong-2.jpg' },
    { th: { name: 'ดร.นฤดม นวลขาว', role: 'อุตสาหกรรมสัมพันธ์', institution: 'สถาบันมาตรวิทยาแห่งชาติ' }, en: { name: 'Dr. Narudom Noulkhow', role: 'Industry Relations', institution: 'National Institute of Metrology (Thailand)' }, image: 'Narudom-1.jpg' },
    { th: { name: 'รศ. ดร.กฤษณ์ อ่างแก้ว', role: 'เลขาธิการ', institution: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ' }, en: { name: 'Assoc. Prof. Dr. Krit Angkeaw', role: 'Secretary', institution: "King Mongkut's University of Technology North Bangkok" }, image: 'Krit-4.jpg' },
    { th: { name: 'รศ. ดร.นนชณัต ฉัตรภูติ', role: 'เหรัญญิก', institution: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ' }, en: { name: 'Assoc. Prof. Dr. Nonchanutt Chudpooti', role: 'Treasurer', institution: "King Mongkut's University of Technology North Bangkok" }, image: 'Nonchanutt.jpg' },
    { th: { name: 'ผศ. ดร.ประภาพร รัตนธำรง', role: 'ประชาสัมพันธ์', institution: 'มหาวิทยาลัยธรรมศาสตร์' }, en: { name: 'Asst. Prof. Dr. Prapaporn Rattanatamrong', role: 'Public Relations', institution: 'Thammasat University' }, image: 'Prapaporn.jpg' },
    { th: { name: 'ผศ. ดร.สกุล คำนวนชัย', role: 'กรรมการกลาง', institution: 'มหาวิทยาลัยราชภัฏเทพสตรี' }, en: { name: 'Asst. Prof. Dr. Skul Kamnuanchai', role: 'Board Member', institution: 'Thepsatri Rajabhat University' }, image: 'Skul-1.jpg' },
    { th: { name: 'ผศ. ดร.วนิดา พฤทธิวิทยา', role: 'กรรมการกลาง', institution: 'มหาวิทยาลัยธรรมศาสตร์' }, en: { name: 'Asst. Prof. Dr. Wanida Putthividhya', role: 'Board Member', institution: 'Thammasat University' }, image: 'Wanida.jpg' },
    { th: { name: 'รศ. ดร.สาคร เมฆรักษาวนิช', role: 'กรรมการสายวิชาการเทคโนโลยีสารสนเทศ', institution: 'มหาวิทยาลัยพะเยา' }, en: { name: 'Assoc. Prof. Dr. Sakorn Mekruksavanich', role: 'Technical Chair (Information Technologies)', institution: 'University of Phayao' }, image: 'Sakorn-2.jpg' },
    { th: { name: 'รศ. ดร.เกริก ภิรมย์โสภา', role: 'กรรมการสายวิชาการคอมพิวเตอร์และปัญญาประดิษฐ์', institution: 'จุฬาลงกรณ์มหาวิทยาลัย' }, en: { name: 'Assoc. Prof. Dr. Krerk Piromsopa', role: 'Technical Chair (Computer and Artificial Intelligence)', institution: 'Chulalongkorn University' }, image: 'Krerk-1.jpg' },
    { th: { name: 'ศ. ดร.นิพนธ์ ธีรอำพน', role: 'กรรมการสายวิชาการวิศวกรรมชีวการแพทย์', institution: 'มหาวิทยาลัยเชียงใหม่' }, en: { name: 'Prof. Dr. Nipon Theera-Umpon', role: 'Technical Chair (Bio-Medical Engineering)', institution: 'Chiang Mai University' }, image: 'Nipon.jpg' },
    { th: { name: 'ศ. ดร.ฐิติพงษ์ เลิศวิริยะประภา', role: 'กรรมการสายวิชาการแม่เหล็กไฟฟ้า', institution: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ' }, en: { name: 'Prof. Dr. Titipong Lertwiriyaprapa', role: 'Technical Chair (Electromagnetics)', institution: "King Mongkut's University of Technology North Bangkok" }, image: 'Titipong-1.jpg' },
    { th: { name: 'ผศ. ดร.ปัณณวิชญ์ ภัทร์สรณ์สิริ', role: 'กรรมการสายวิชาการอิเล็กทรอนิกส์', institution: 'สถาบันเทคโนโลยีปทุมวัน' }, en: { name: 'Asst. Prof. Dr. Punnavich Phatsornsiri', role: 'Technical Chair (Electronics)', institution: 'Pathumwan Institute of Technology' }, image: 'Punnavich-3.jpg' },
    { th: { name: 'ผศ. ดร.สาธิต มังคลาจารย์', role: 'กรรมการสายวิชาการสายระบบควบคุมและหุ่นยนต์', institution: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ' }, en: { name: 'Asst. Prof. Dr. Satit Mangkalajan', role: 'Technical Chair (System Control and Robotics)', institution: "King Mongkut's University of Technology North Bangkok" }, image: 'Satit-1.jpg' },
    { th: { name: 'รศ. ดร.อุเทน คำน่าน', role: 'กรรมการสายวิชาการวิศวกรรมไฟฟ้า', institution: 'มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา' }, en: { name: 'Assoc. Prof. Dr. Uthen Khamnan', role: 'Technical Chair (Electrical Engineering)', institution: 'Rajamangala University of Technology Lanna' }, image: 'Uthen.jpg' },
    { th: { name: 'ศ. ดร.ชานนท์ วริสาร', role: 'กรรมการสายวิชาการโทรคมนาคม', institution: 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง' }, en: { name: 'Prof. Dr. Chanon Warisarn', role: 'Technical Chair (Telecommunications)', institution: "King Mongkut's Institute of Technology Ladkrabang" }, image: 'Chanon-4.jpg' },
    { th: { name: 'ผศ.ดร.พันศักดิ์ เทียนวิบูลย์', role: 'กรรมการสายวิชาการประมวลผลสัญญาณ', institution: 'มหาวิทยาลัยเกษตรศาสตร์' }, en: { name: 'Asst. Prof. Dr. Phunsak Thiennviboon', role: 'Technical Chair (Signal Processing)', institution: 'Kasetsart University' }, image: 'Phunsak-1.jpg' },
  ];

  // Remove null-term rows of every seed-managed name: the old mocks, and
  // null-term copies of the real members. The latter exist because a Strapi
  // Cloud deploy can replace the container mid-seed — the first boot on
  // 2026-07-17 ran before the term column migration applied, created 15
  // members with term = null, and the (name, term) guard below can't see
  // them, so the second boot duplicated everyone. Scoped to known names so a
  // member an admin typed in themselves survives.
  // (documents().delete leaves rows with no draft version, so use db.query.)
  const seedManagedNames = [
    ...MOCK_NAMES,
    ...members.flatMap((m) => [m.th.name, m.en.name]),
  ];
  await strapi.db.query(uid).deleteMany({
    where: { name: { $in: seedManagedNames }, term: { $null: true } },
  });

  // Photo morphs of rows deleted above would linger — clear the orphans.
  await strapi.db.connection.raw(`
    DELETE FROM files_related_mph
    WHERE related_type = 'api::board-member.board-member'
      AND related_id NOT IN (SELECT id FROM board_members)
  `);

  for (const m of members) {
    const found = await strapi.db
      .query(uid)
      // oldest row first = the th draft the photo morph lands on (see below)
      .findOne({ where: { name: m.th.name, term: BOARD_TERM }, populate: ['image'], orderBy: { id: 'asc' } });
    if (found?.image) continue; // fully seeded — don't clobber admin edits or uploaded photos

    const imageId = await uploadRemoteImage(strapi, BOARD_IMAGE_BASE + m.image, m.image);

    if (found) {
      // Member exists but the photo download failed on an earlier run — attach it now.
      if (imageId) {
        for (const locale of ['th', 'en']) {
          await strapi.documents(uid).update({
            documentId: found.documentId,
            data: { image: imageId },
            locale,
            status: 'published',
          });
        }
      }
      continue;
    }

    const doc = await strapi.documents(uid).create({
      data: {
        name: m.th.name,
        role: m.th.role,
        institution: m.th.institution,
        term: BOARD_TERM,
        ...(imageId ? { image: imageId } : {}),
      },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents(uid).update({
      documentId: doc.documentId,
      data: {
        name: m.en.name,
        role: m.en.role,
        institution: m.en.institution,
        ...(imageId ? { image: imageId } : {}),
      },
      locale: 'en',
      status: 'published',
    });
  }

  // Strapi 5's publish clone drops media morphs created through the document
  // service, leaving the photo attached to the th draft row only. Copy each
  // photo morph to sibling rows (same document, other locale/status) that have
  // no photo yet — fill-only, never overrides an editor's change.
  await strapi.db.connection.raw(`
    INSERT INTO files_related_mph (file_id, related_id, related_type, field, "order")
    SELECT m.file_id, r2.id, m.related_type, m.field, m."order"
    FROM files_related_mph m
    JOIN board_members r1 ON r1.id = m.related_id
    JOIN board_members r2 ON r2.document_id = r1.document_id AND r2.id <> r1.id
    WHERE m.related_type = 'api::board-member.board-member'
      AND m.field = 'image'
      AND NOT EXISTS (
        SELECT 1 FROM files_related_mph m2
        WHERE m2.related_id = r2.id
          AND m2.related_type = m.related_type
          AND m2.field = m.field
      )
  `);

  strapi.log.info(`[seed] Board members (${BOARD_TERM}) seeded`);
}

// ─── Milestones ──────────────────────────────────────────────────────────────

async function seedMilestones(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::milestone.milestone') > 0) return;

  const milestones = [
    { year: 2003, th: { title: 'ก่อตั้งสมาคม ECTI', description: 'สมาคม ECTI ก่อตั้งขึ้นอย่างเป็นทางการโดยกลุ่มนักวิชาการชั้นนำด้านวิศวกรรมไฟฟ้าและสารสนเทศ' }, en: { title: 'ECTI Association Founded', description: 'ECTI Association was officially established by leading academics in electrical engineering and information technology.' } },
    { year: 2004, th: { title: 'ECTI-CON ครั้งแรก', description: 'จัดการประชุมวิชาการนานาชาติ ECTI-CON ครั้งที่ 1 ที่พัทยา จ.ชลบุรี' }, en: { title: 'First ECTI-CON Conference', description: 'The 1st ECTI International Conference (ECTI-CON) was held in Pattaya, Chonburi.' } },
    { year: 2006, th: { title: 'เปิดตัววารสาร ECTI Transactions', description: 'เริ่มตีพิมพ์วารสาร ECTI-EEC และ ECTI-CIT อย่างเป็นทางการ' }, en: { title: 'ECTI Transactions Launched', description: 'Official publication of ECTI-EEC and ECTI-CIT Transactions journals began.' } },
    { year: 2012, th: { title: 'วารสารเข้า Scopus', description: 'วารสาร ECTI-EEC ได้รับการจัดเข้า Scopus database เป็นครั้งแรก' }, en: { title: 'Scopus Indexing', description: 'ECTI-EEC journal was indexed in the Scopus database for the first time.' } },
    { year: 2018, th: { title: 'สมาชิกครบ 2,000 คน', description: 'จำนวนสมาชิกสมาคมเติบโตถึง 2,000 คนจากทั่วประเทศ' }, en: { title: '2,000 Members Milestone', description: 'The association\'s membership grew to 2,000 members nationwide.' } },
    { year: 2023, th: { title: 'ครบรอบ 20 ปี', description: 'สมาคมครบรอบ 20 ปีพร้อมจัดงาน ECTI-CON ครั้งที่ 20 ที่ จ.นครศรีธรรมราช' }, en: { title: '20th Anniversary', description: 'ECTI celebrated its 20th anniversary with the 20th ECTI-CON in Nakhon Si Thammarat.' } },
    { year: 2026, th: { title: 'สมาชิกกว่า 3,000 คน', description: 'สมาคมเติบโตอย่างต่อเนื่องด้วยสมาชิกกว่า 3,000 คนและพันธมิตรนานาชาติ' }, en: { title: '3,000+ Members', description: 'The association continues to grow with 3,000+ members and international partnerships.' } },
  ];

  for (const m of milestones) {
    const doc = await strapi.documents('api::milestone.milestone').create({
      data: { year: m.year, title: m.th.title, description: m.th.description },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::milestone.milestone').update({
      documentId: doc.documentId,
      data: { title: m.en.title, description: m.en.description },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Milestones created');
}

// ─── Mission-Vision (Single Type) ────────────────────────────────────────────

async function seedSingleType<T extends string>(
  strapi: Core.Strapi,
  uid: Parameters<Core.Strapi['documents']>[0],
  thData: Record<string, unknown>,
  enData: Record<string, unknown>,
  checkField: string
) {
  const existing = await (strapi.documents(uid) as any).findFirst({ locale: 'th', populate: [checkField] });
  if (existing?.[checkField]?.length) return;

  if (!existing) {
    const doc = await (strapi.documents(uid) as any).create({ data: thData, locale: 'th', status: 'published' });
    await (strapi.documents(uid) as any).update({ documentId: doc.documentId, data: enData, locale: 'en', status: 'published' });
  } else {
    await (strapi.documents(uid) as any).update({ documentId: existing.documentId, data: thData, locale: 'th', status: 'published' });
    await (strapi.documents(uid) as any).update({ documentId: existing.documentId, data: enData, locale: 'en', status: 'published' });
  }
}

async function seedMissionVision(strapi: Core.Strapi) {
  await seedSingleType(
    strapi,
    'api::mission-vision.mission-vision',
    {
      cards: [
        { title: 'พันธกิจ', description: 'ส่งเสริมและสนับสนุนความก้าวหน้าทางวิชาการและวิชาชีพด้านวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคม และสารสนเทศ เพื่อพัฒนาประเทศชาติและสังคม' },
        { title: 'วิสัยทัศน์', description: 'เป็นองค์กรวิชาการชั้นนำระดับนานาชาติที่เชื่อมโยงนักวิจัย นักวิชาการ และภาคอุตสาหกรรมในภูมิภาคอาเซียนและทั่วโลก' },
      ],
    },
    {
      cards: [
        { title: 'Mission', description: 'To promote and support academic and professional advancement in Electrical Engineering, Electronics, Computer Science, Telecommunications, and Information Technology for national and social development.' },
        { title: 'Vision', description: 'To be a leading international academic organization connecting researchers, academics, and industry professionals across ASEAN and the world.' },
      ],
    },
    'cards'
  );
  strapi.log.info('[seed] Mission-Vision created');
}

// ─── Objectives (Single Type) ────────────────────────────────────────────────

async function seedObjectives(strapi: Core.Strapi) {
  const thItems = [
    'ส่งเสริมการวิจัยและพัฒนาในสาขาวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ และสารสนเทศ',
    'จัดประชุมวิชาการและสัมมนาระดับชาติและนานาชาติ',
    'ตีพิมพ์เผยแพร่ผลงานวิจัยคุณภาพสูงผ่านวารสารวิชาการ',
    'พัฒนาเครือข่ายความร่วมมือระหว่างสถาบันการศึกษาและภาคอุตสาหกรรม',
    'สนับสนุนการพัฒนาบุคลากรด้านวิศวกรรมและเทคโนโลยี',
    'ส่งเสริมจริยธรรมและมาตรฐานวิชาชีพในสาขาที่เกี่ยวข้อง',
  ];
  const enItems = [
    'Promote research and development in Electrical Engineering, Electronics, and Information Technology',
    'Organize national and international conferences and seminars',
    'Publish high-quality research through academic journals',
    'Develop collaborative networks between academic institutions and industry',
    'Support human resource development in engineering and technology',
    'Promote ethics and professional standards in related fields',
  ];

  await seedSingleType(
    strapi,
    'api::objective.objective',
    { items: thItems.map(text => ({ text })) },
    { items: enItems.map(text => ({ text })) },
    'items'
  );
  strapi.log.info('[seed] Objectives created');
}

// ─── Activities ──────────────────────────────────────────────────────────────

async function seedActivities(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::activity.activity') > 0) return;

  const activities = [
    {
      slug: 'ecti-con-2026',
      shared: { year: 2026, type: 'conference', event_status: 'open', event_start_date: '2026-07-09', event_end_date: '2026-07-12', register_url: '' },
      th: { title: 'ECTI-CON 2026', location: 'โรงแรมเลอ เมอริเดียน เชียงใหม่', description: [{ type: 'paragraph', children: [{ type: 'text', text: 'การประชุมวิชาการนานาชาติ ECTI ครั้งที่ 23 ด้านวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคมและสารสนเทศ' }] }], deadline: [{ title: 'กำหนดส่งบทความ', date: '2026-04-30' }, { title: 'แจ้งผลพิจารณา', date: '2026-05-31' }, { title: 'ส่งฉบับสมบูรณ์', date: '2026-06-15' }] },
      en: { title: 'ECTI-CON 2026', location: 'Le Meridien Chiang Mai Hotel', description: [{ type: 'paragraph', children: [{ type: 'text', text: 'The 23rd ECTI International Conference on Electrical Engineering/Electronics, Computer, Telecommunications and Information Technology.' }] }], deadline: [{ title: 'Paper Submission', date: '2026-04-30' }, { title: 'Notification', date: '2026-05-31' }, { title: 'Camera Ready', date: '2026-06-15' }] },
    },
    {
      slug: 'ecti-card-2026',
      shared: { year: 2026, type: 'conference', event_status: 'upcoming', event_start_date: '2026-05-08', event_end_date: '2026-05-10', register_url: '' },
      th: { title: 'ECTI-CARD 2026', location: 'มหาวิทยาลัยเชียงใหม่', description: [{ type: 'paragraph', children: [{ type: 'text', text: 'การประชุมวิชาการ ECTI Conference on Application Research and Development ครั้งที่ 5' }] }], deadline: [{ title: 'กำหนดส่งบทความ', date: '2026-03-15' }] },
      en: { title: 'ECTI-CARD 2026', location: 'Chiang Mai University', description: [{ type: 'paragraph', children: [{ type: 'text', text: 'The 5th ECTI Conference on Application Research and Development.' }] }], deadline: [{ title: 'Paper Submission', date: '2026-03-15' }] },
    },
    {
      slug: 'ecti-con-2025',
      shared: { year: 2025, type: 'conference', event_status: 'finished', event_start_date: '2025-06-25', event_end_date: '2025-06-28', register_url: '' },
      th: { title: 'ECTI-CON 2025', location: 'โรงแรมอมารี วอเตอร์เกท กรุงเทพฯ', description: [{ type: 'paragraph', children: [{ type: 'text', text: 'การประชุมวิชาการนานาชาติ ECTI ครั้งที่ 22 ณ กรุงเทพมหานคร' }] }], deadline: [] },
      en: { title: 'ECTI-CON 2025', location: 'Amari Watergate Hotel, Bangkok', description: [{ type: 'paragraph', children: [{ type: 'text', text: 'The 22nd ECTI International Conference held in Bangkok.' }] }], deadline: [] },
    },
  ];

  for (const a of activities) {
    const doc = await strapi.documents('api::activity.activity').create({
      data: { slug: a.slug, ...a.shared, title: a.th.title, location: a.th.location, description: a.th.description, deadline: a.th.deadline } as any,
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::activity.activity').update({
      documentId: doc.documentId,
      // slug is a non-localized uid; set it explicitly on the en locale so the
      // localized event URL resolves (Strapi does not propagate uid across locales).
      data: { slug: a.slug, title: a.en.title, location: a.en.location, description: a.en.description, deadline: a.en.deadline } as any,
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Activities created');
}

// ─── Benefits ────────────────────────────────────────────────────────────────

async function seedBenefits(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::benefit.benefit') > 0) return;

  const benefits = [
    { th: 'รับวารสาร ECTI Transactions ทั้ง ECTI-EEC และ ECTI-CIT ฟรีตลอดปี', en: 'Free access to ECTI Transactions journals (ECTI-EEC and ECTI-CIT) throughout the year' },
    { th: 'ส่วนลดค่าลงทะเบียนประชุมวิชาการ ECTI-CON และงานอื่นๆ ของสมาคม', en: 'Discounted registration fees for ECTI-CON and other association conferences' },
    { th: 'เข้าถึงเครือข่ายนักวิจัยและนักวิชาการกว่า 3,000 คนทั่วประเทศ', en: 'Access to a network of over 3,000 researchers and academics nationwide' },
    { th: 'สิทธิ์ออกเสียงในการประชุมใหญ่และเลือกตั้งคณะกรรมการสมาคม', en: 'Voting rights at general meetings and in the election of association board members' },
    { th: 'รับข่าวสารและประกาศล่าสุดจากสมาคมก่อนใคร', en: 'Receive the latest news and announcements from the association before anyone else' },
    { th: 'สนับสนุนการขอทุนวิจัยและความร่วมมือระหว่างสถาบัน', en: 'Support for research funding applications and inter-institutional collaborations' },
  ];

  for (const b of benefits) {
    const doc = await strapi.documents('api::benefit.benefit').create({
      data: { description: b.th },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::benefit.benefit').update({
      documentId: doc.documentId,
      data: { description: b.en },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Benefits created');
}

// ─── Member Types ────────────────────────────────────────────────────────────

async function seedMemberTypes(strapi: Core.Strapi) {
  // Canonical member types from the ECTI bylaws. Two categories: juristic
  // (corporate) and non-juristic (regular / student / fellow / honorary).
  // Fees: only Regular and Student are currently known; the others are left
  // blank for editors to fill in via CMS.
  const types = [
    {
      key: 'regular',
      th: { type: 'สมาชิกสามัญ', eligibility: 'ผู้จบการศึกษาระดับปริญญาตรีขึ้นไปในสาขาวิศวกรรมไฟฟ้า คอมพิวเตอร์ อิเล็กทรอนิกส์ สื่อสารโทรคมนาคม เทคโนโลยีสารสนเทศ หรือสาขาที่เกี่ยวข้อง (สาขาอื่นต้องได้รับการรับรองจากสมาชิกสามัญหรือวุฒิสมาชิกอย่างน้อย 3 คน)' },
      en: { type: 'Regular Member', eligibility: "Holders of a bachelor's degree or higher in electrical, computer, electronics, telecommunications, or information technology engineering, or a related field (other fields require endorsement by at least 3 regular or fellow members)." },
      membership_fee: 1000, entrance_fee: 200,
    },
    {
      key: 'student',
      th: { type: 'สมาชิกนักศึกษา', eligibility: 'นักเรียนหรือนักศึกษาที่กำลังศึกษาอยู่ (ผู้ยังไม่บรรลุนิติภาวะต้องได้รับการรับรองจากผู้ปกครอง)' },
      en: { type: 'Student Member', eligibility: 'Currently enrolled students or pupils (minors require parental consent).' },
      membership_fee: 200, entrance_fee: 100,
    },
    {
      key: 'fellow',
      th: { type: 'วุฒิสมาชิก', eligibility: 'สมาชิกสามัญมาแล้วไม่ต่ำกว่า 8 ปี หรือเคยเป็นกรรมการอำนวยการรวมอย่างน้อย 4 ปี และมีผลงานวิชาการหรือประสบการณ์วิชาชีพเป็นที่ประจักษ์ โดยคณะกรรมการอำนวยการลงมติเห็นชอบ' },
      en: { type: 'Fellow Member', eligibility: 'Regular members for at least 8 years, or former executive board members for a total of at least 4 years, with recognized academic or professional achievements, approved by resolution of the executive board.' },
      membership_fee: null, entrance_fee: null,
    },
    {
      key: 'honorary',
      th: { type: 'สมาชิกกิตติมศักดิ์', eligibility: 'บุคคลผู้ทรงเกียรติ ทรงคุณวุฒิ หรือผู้มีอุปการคุณแก่สมาคม ซึ่งคณะกรรมการอำนวยการลงมติเชิญเข้าเป็นสมาชิก' },
      en: { type: 'Honorary Member', eligibility: 'Distinguished or highly qualified individuals, or benefactors of the association, invited to membership by resolution of the executive board.' },
      membership_fee: null, entrance_fee: null,
    },
    {
      key: 'corporate',
      th: { type: 'สมาชิกนิติบุคคล', eligibility: 'สถาบันการศึกษา หน่วยงานของรัฐหรือเอกชน บริษัท และห้างร้านที่ให้การสนับสนุนสมาคม ซึ่งคณะกรรมการอำนวยการลงมติรับเข้าเป็นสมาชิก' },
      en: { type: 'Corporate Member', eligibility: 'Educational institutions, government or private agencies, companies, and businesses that support the association, admitted by resolution of the executive board.' },
      membership_fee: null, entrance_fee: null,
    },
  ];

  // One-time cleanup: drop legacy rows seeded before the `key` field existed.
  // deleteMany on the low-level db query removes every matching row (draft +
  // published, all locales); the document service delete leaves them behind.
  await strapi.db.query('api::member-type.member-type').deleteMany({ where: { key: null } });

  for (const t of types) {
    const found = await strapi.db
      .query('api::member-type.member-type')
      .findOne({ where: { key: t.key } });
    if (found) continue; // already seeded — don't clobber editor changes

    const doc = await strapi.documents('api::member-type.member-type').create({
      data: { key: t.key, type: t.th.type, eligibility: t.th.eligibility, membership_fee: t.membership_fee, entrance_fee: t.entrance_fee },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::member-type.member-type').update({
      documentId: doc.documentId,
      data: { type: t.en.type, eligibility: t.en.eligibility },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Member types created');
}

// ─── How to Join ─────────────────────────────────────────────────────────────

async function seedHowToJoins(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::howto-join.howto-join') > 0) return;

  const steps = [
    { order: 1, th: { title: 'ตรวจสอบคุณสมบัติ', description: 'ตรวจสอบประเภทสมาชิกที่เหมาะสมกับคุณสมบัติของคุณ ทั้งสมาชิกสามัญ วิสามัญ และนิติบุคคล' }, en: { title: 'Check Eligibility', description: 'Review the membership types and find the one that matches your qualifications: Regular, Associate, or Corporate.' } },
    { order: 2, th: { title: 'กรอกใบสมัคร', description: 'กรอกแบบฟอร์มใบสมัครสมาชิกออนไลน์พร้อมแนบเอกสารประกอบที่จำเป็น' }, en: { title: 'Fill Application Form', description: 'Complete the online membership application form and attach the required supporting documents.' } },
    { order: 3, th: { title: 'ชำระค่าธรรมเนียม', description: 'ชำระค่าธรรมเนียมสมาชิกผ่านช่องทางที่กำหนด และส่งหลักฐานการชำระเงิน' }, en: { title: 'Pay Membership Fee', description: 'Pay the membership fee through the designated channels and submit your payment proof.' } },
    { order: 4, th: { title: 'รับการยืนยัน', description: 'รอรับอีเมลยืนยันการเป็นสมาชิกภายใน 7-14 วันทำการ พร้อมรหัสสมาชิก' }, en: { title: 'Receive Confirmation', description: 'Wait for a membership confirmation email within 7-14 business days, along with your member ID.' } },
  ];

  for (const s of steps) {
    const doc = await strapi.documents('api::howto-join.howto-join').create({
      data: { order: s.order, title: s.th.title, description: s.th.description },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::howto-join.howto-join').update({
      documentId: doc.documentId,
      data: { title: s.en.title, description: s.en.description },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] How-to-join steps created');
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

async function seedQuestions(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::question.question') > 0) return;

  const faqs = [
    {
      th: { question: 'ใครสามารถสมัครเป็นสมาชิก ECTI ได้บ้าง?', answer: [{ type: 'paragraph', children: [{ type: 'text', text: 'ผู้ที่สำเร็จการศึกษาระดับปริญญาตรีขึ้นไป หรือกำลังศึกษาในสาขาวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคม สารสนเทศ หรือสาขาที่เกี่ยวข้อง สามารถสมัครสมาชิกได้ทุกประเภท' }] }] },
      en: { question: 'Who can apply for ECTI membership?', answer: [{ type: 'paragraph', children: [{ type: 'text', text: 'Anyone who holds a bachelor\'s degree or higher, or is currently studying in Electrical Engineering, Electronics, Computer Science, Telecommunications, IT, or related fields can apply for any membership type.' }] }] },
    },
    {
      th: { question: 'ค่าธรรมเนียมสมาชิกรายปีคือเท่าไร?', answer: [{ type: 'paragraph', children: [{ type: 'text', text: 'ค่าธรรมเนียมสมาชิกสามัญรายปีคือ 500 บาท สมาชิกวิสามัญ (นักศึกษา) 200 บาทต่อปี และสมาชิกนิติบุคคล 5,000 บาทต่อปี นอกจากนี้ยังมีตัวเลือกสมาชิกตลอดชีพสำหรับสมาชิกสามัญในราคา 5,000 บาท' }] }] },
      en: { question: 'What are the annual membership fees?', answer: [{ type: 'paragraph', children: [{ type: 'text', text: 'Annual fees: Regular Member 500 THB, Associate Member (Student) 200 THB, Corporate Member 5,000 THB. A lifetime membership option is available for Regular Members at 5,000 THB.' }] }] },
    },
    {
      th: { question: 'ใช้เวลานานแค่ไหนในการอนุมัติการสมัคร?', answer: [{ type: 'paragraph', children: [{ type: 'text', text: 'โดยทั่วไปกระบวนการอนุมัติใช้เวลา 7-14 วันทำการ นับจากวันที่ได้รับเอกสารและหลักฐานการชำระเงินครบถ้วน' }] }] },
      en: { question: 'How long does the approval process take?', answer: [{ type: 'paragraph', children: [{ type: 'text', text: 'The approval process generally takes 7-14 business days from the date we receive all complete documents and payment proof.' }] }] },
    },
    {
      th: { question: 'สมาชิกได้รับสิทธิพิเศษอะไรบ้างในการประชุมวิชาการ?', answer: [{ type: 'paragraph', children: [{ type: 'text', text: 'สมาชิกจะได้รับส่วนลดค่าลงทะเบียนสำหรับการประชุม ECTI-CON, ECTI-CARD และงานอื่นๆ ของสมาคม รวมถึงสิทธิ์ในการเสนอบทความในราคาพิเศษ' }] }] },
      en: { question: 'What special privileges do members get for conferences?', answer: [{ type: 'paragraph', children: [{ type: 'text', text: 'Members receive discounted registration fees for ECTI-CON, ECTI-CARD, and other association events, as well as special pricing for paper submissions.' }] }] },
    },
  ];

  for (const f of faqs) {
    const doc = await strapi.documents('api::question.question').create({
      data: { question: f.th.question, answer: f.th.answer },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::question.question').update({
      documentId: doc.documentId,
      data: { question: f.en.question, answer: f.en.answer },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] FAQ created');
}

// ─── Resources ───────────────────────────────────────────────────────────────

async function seedResources(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::resource.resource') > 0) return;

  const resources = [
    { th: { title: 'ECTI-CON 2025 Proceedings', description: 'รวมบทความวิจัยที่นำเสนอในการประชุม ECTI-CON 2025' }, en: { title: 'ECTI-CON 2025 Proceedings', description: 'Collection of research papers presented at ECTI-CON 2025.' }, link: 'https://ieeexplore.ieee.org', platform: 'YouTube', date: '2025-07-01' },
    { th: { title: 'แนะนำการเขียนบทความ IEEE', description: 'วิดีโอแนะนำการเขียนและส่งบทความในรูปแบบ IEEE สำหรับการประชุมและวารสาร' }, en: { title: 'IEEE Paper Writing Guide', description: 'Video guide on writing and submitting papers in IEEE format for conferences and journals.' }, link: 'https://youtube.com', platform: 'YouTube', date: '2025-03-15' },
    { th: { title: 'เครือข่ายนักวิจัย ECTI', description: 'เข้าร่วมกลุ่ม LinkedIn ของสมาคม ECTI เพื่อติดตามข่าวสารและสร้างเครือข่าย' }, en: { title: 'ECTI Researcher Network', description: 'Join the ECTI Association LinkedIn group to follow news and build your professional network.' }, link: 'https://linkedin.com', platform: 'LinkedIn', date: '2024-01-01' },
    { th: { title: 'คู่มือนักวิจัยหน้าใหม่', description: 'คู่มือสำหรับนักวิจัยมือใหม่ที่ต้องการเริ่มต้นตีพิมพ์บทความในวารสารนานาชาติ' }, en: { title: 'New Researcher Guide', description: 'A guide for new researchers who want to start publishing papers in international journals.' }, link: 'https://facebook.com/ecti', platform: 'Facebook', date: '2024-06-01' },
  ];

  for (const r of resources) {
    const doc = await strapi.documents('api::resource.resource').create({
      data: { title: r.th.title, description: r.th.description, link: r.link, platform: r.platform, date: r.date },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::resource.resource').update({
      documentId: doc.documentId,
      data: { title: r.en.title, description: r.en.description },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Resources created');
}

// ─── Journals (Publications) ─────────────────────────────────────────────────

async function seedJournals(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::journal.journal') > 0) return;

  const journals = [
    {
      order: 1,
      url: 'https://ph01.tci-thaijo.org/index.php/ECTI-EEC',
      th: {
        title: 'ECTI Transactions on Electrical Eng., Electronics, and Communications (ECTI-EEC)',
        description: 'วารสารที่ครอบคลุมงานวิจัยด้านวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ และการสื่อสาร',
      },
      en: {
        title: 'ECTI Transactions on Electrical Eng., Electronics, and Communications (ECTI-EEC)',
        description: 'A journal covering research in electrical engineering, electronics, and communications.',
      },
    },
    {
      order: 2,
      url: 'https://ph01.tci-thaijo.org/index.php/ecticit',
      th: {
        title: 'ECTI Transactions on Computer and Information Technology (ECTI-CIT)',
        description: 'วารสารที่ครอบคลุมงานวิจัยด้านวิทยาการคอมพิวเตอร์และเทคโนโลยีสารสนเทศ',
      },
      en: {
        title: 'ECTI Transactions on Computer and Information Technology (ECTI-CIT)',
        description: 'A journal covering research in computer science and information technology.',
      },
    },
    {
      order: 3,
      url: 'https://ph01.tci-thaijo.org/index.php/ECTI-ARD',
      th: {
        title: 'ECTI Journal on Applied Research and Development (ECTI-ARD)',
        description: 'วารสารที่ครอบคลุมงานวิจัยด้านการประยุกต์ใช้เทคโนโลยีวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ และสารสนเทศ เพื่อนำไปสู่นวัตกรรมที่เป็นประโยชน์',
      },
      en: {
        title: 'ECTI Journal on Applied Research and Development (ECTI-ARD)',
        description: 'A journal covering applied research in electrical engineering, electronics, computer, and information technology, driving innovation for practical benefit.',
      },
    },
  ];

  for (const j of journals) {
    const doc = await strapi.documents('api::journal.journal').create({
      data: { title: j.th.title, description: j.th.description, url: j.url, order: j.order },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::journal.journal').update({
      documentId: doc.documentId,
      data: { title: j.en.title, description: j.en.description },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Journals created');
}

// ─── Conferences (Publications) ──────────────────────────────────────────────
// Regular ECTI conferences: ECTI-CON, ECTI-CARD, ITC-CSCC, ICA-SYMP.

async function seedConferences(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::conference.conference') > 0) return;

  const conferences = [
    {
      order: 1,
      th: {
        title: 'ECTI-CON',
        description:
          'ECTI-CON (International Conference on Electrical Engineering/Electronics, Computer, Telecommunications and Information Technology) เป็นงานประชุมวิชาการระดับนานาชาติและเป็นงานหลักของสมาคม ECTI จัดต่อเนื่องเป็นประจำทุกปีตั้งแต่ปี พ.ศ. 2547\n\nงานครอบคลุมงานวิจัยด้านวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคม และเทคโนโลยีสารสนเทศ เป็นเวทีให้นักวิจัยทั้งในและต่างประเทศได้นำเสนอผลงานและแลกเปลี่ยนความรู้ โดยบทความที่ผ่านการพิจารณาจะได้รับการเผยแพร่ในฐานข้อมูล IEEE Xplore',
        years: '2547–ปัจจุบัน',
      },
      en: {
        title: 'ECTI-CON',
        description:
          "ECTI-CON (International Conference on Electrical Engineering/Electronics, Computer, Telecommunications and Information Technology) is the association's flagship international conference, held every year since 2004.\n\nIt spans research in electrical engineering, electronics, computer, telecommunications, and information technology, giving researchers from Thailand and abroad a venue to present their work and exchange knowledge. Accepted papers are published in the IEEE Xplore database.",
        years: '2004–present',
      },
    },
    {
      order: 2,
      th: {
        title: 'ECTI-CARD',
        description:
          'ECTI-CARD (Conference on Application Research and Development) เป็นงานประชุมวิชาการระดับชาติที่เน้นงานวิจัยและพัฒนาเชิงประยุกต์ จัดต่อเนื่องเป็นประจำทุกปีตั้งแต่ปี พ.ศ. 2552\n\nงานมุ่งส่งเสริมการนำผลงานวิจัยไปประยุกต์ใช้ได้จริง และเชื่อมโยงงานวิจัยเข้ากับภาคอุตสาหกรรมและชุมชน เปิดโอกาสให้นักวิจัย นักวิชาการ และนักศึกษาได้เผยแพร่ผลงานและสร้างเครือข่ายความร่วมมือทางวิชาการ',
        years: '2552–ปัจจุบัน',
      },
      en: {
        title: 'ECTI-CARD',
        description:
          'ECTI-CARD (Conference on Application Research and Development) is a national conference focused on applied research and development, held every year since 2009.\n\nIt promotes turning research into practical use and connects academic work with industry and communities, giving researchers, academics, and students a platform to share their work and build collaborative networks.',
        years: '2009–present',
      },
    },
    {
      order: 3,
      th: {
        title: 'ITC-CSCC',
        description:
          'ITC-CSCC (International Technical Conference on Circuits/Systems, Computers and Communications) เป็นงานประชุมวิชาการระดับนานาชาติด้านวงจร ระบบ คอมพิวเตอร์ และการสื่อสาร ที่จัดร่วมกับสมาคมวิชาการในต่างประเทศและหมุนเวียนประเทศเจ้าภาพ\n\nสมาคม ECTI ร่วมเป็นเจ้าภาพจัดงานนี้ ซึ่งเป็นเวทีสำคัญให้นักวิจัยได้นำเสนอผลงานและสร้างความร่วมมือทางวิชาการในระดับนานาชาติ',
        years: '2553, 2557, 2561',
      },
      en: {
        title: 'ITC-CSCC',
        description:
          'ITC-CSCC (International Technical Conference on Circuits/Systems, Computers and Communications) is an international conference on circuits, systems, computers, and communications, co-organized with academic societies abroad and rotated among host countries.\n\nThe ECTI Association is one of its co-organizers, and the conference serves as a venue for researchers to present their work and build international academic collaboration.',
        years: '2010, 2014, 2018',
      },
    },
    {
      order: 4,
      th: {
        title: 'ICA-SYMP',
        description:
          'ICA-SYMP (International Symposium on Instrumentation, Control, Artificial Intelligence, and Robotics) เป็นงานประชุมวิชาการระดับนานาชาติด้านระบบวัดคุม การควบคุม ปัญญาประดิษฐ์ และหุ่นยนต์\n\nเป็นงานที่ค่อนข้างใหม่ เริ่มจัดในปี พ.ศ. 2566 เพื่อรองรับความสนใจที่เพิ่มขึ้นในด้านปัญญาประดิษฐ์และระบบอัตโนมัติ เปิดเวทีให้นักวิจัยได้นำเสนอผลงานและแลกเปลี่ยนความรู้ในสาขาที่กำลังเติบโต',
        years: '2566, 2568',
      },
      en: {
        title: 'ICA-SYMP',
        description:
          'ICA-SYMP (International Symposium on Instrumentation, Control, Artificial Intelligence, and Robotics) is an international symposium covering instrumentation, control systems, artificial intelligence, and robotics.\n\nA relatively new event first held in 2023, it responds to growing interest in AI and automation, giving researchers a venue to present their work and exchange knowledge in these fast-growing fields.',
        years: '2023, 2025',
      },
    },
  ];

  for (const c of conferences) {
    const doc = await strapi.documents('api::conference.conference').create({
      data: { title: c.th.title, description: c.th.description, years: c.th.years, order: c.order },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::conference.conference').update({
      documentId: doc.documentId,
      data: { title: c.en.title, description: c.en.description, years: c.en.years },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Conferences created');
}

// ─── Contact (Single Type) ───────────────────────────────────────────────────

async function seedContact(strapi: Core.Strapi) {
  const existing = await (strapi.documents('api::contact.contact') as any).findFirst({ locale: 'th' });
  if (existing?.email) return;

  const th = {
    address: 'สมาคม ECTI สำนักงานคณะวิศวกรรมศาสตร์ มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ กรุงเทพฯ 10800',
    email: 'info@ecti.or.th',
    phone: '02-555-2000 ต่อ 8218',
    office_hours: 'จันทร์–ศุกร์ 09:00–16:30 น.',
  };
  const en = {
    address: "ECTI Association, Faculty of Engineering, King Mongkut's University of Technology North Bangkok, Bangkok 10800, Thailand",
    phone: '02-555-2000 ext. 8218',
    office_hours: 'Monday - Friday, 09:00 - 16:30',
  };

  const doc = await strapi.documents('api::contact.contact').create({
    data: th,
    locale: 'th',
    status: 'published',
  });
  await strapi.documents('api::contact.contact').update({
    documentId: doc.documentId,
    data: en,
    locale: 'en',
    status: 'published',
  });
  strapi.log.info('[seed] Contact created');
}

// ─── Social Links (Single Type) ──────────────────────────────────────────────

// Initial values migrated from the previously hardcoded footer. Editors can
// update these (or clear a field to hide its icon) in CMS → "Social Links".
async function seedSocialLinks(strapi: Core.Strapi) {
  const existing = await (strapi.documents('api::social-link.social-link') as any).findFirst({ locale: 'th' });
  if (existing) return;

  const data = {
    facebook_url: 'https://facebook.com/ecaboratory',
    x_url: 'https://x.com/ecti',
    linkedin_url: 'https://linkedin.com/company/ecti',
    youtube_url: '',
  };

  const doc = await strapi.documents('api::social-link.social-link').create({
    data,
    locale: 'th',
    status: 'published',
  });
  await strapi.documents('api::social-link.social-link').update({
    documentId: doc.documentId,
    data,
    locale: 'en',
    status: 'published',
  });
  strapi.log.info('[seed] Social links created');
}

// ─── Membership Apply Link (Single Type) ─────────────────────────────────────

// The real JotForm URL is managed in the CMS (Single Types → "Membership — Apply Link").
// Leave this empty so the button falls back to /contact until an editor sets the URL.
const MEMBERSHIP_FORM_URL = '';

async function seedMembershipApply(strapi: Core.Strapi) {
  const existing = await (strapi.documents('api::membership-apply.membership-apply') as any).findFirst({ locale: 'th' });
  if (existing) return;

  const data = { form_url: MEMBERSHIP_FORM_URL };

  const doc = await strapi.documents('api::membership-apply.membership-apply').create({
    data,
    locale: 'th',
    status: 'published',
  });
  await strapi.documents('api::membership-apply.membership-apply').update({
    documentId: doc.documentId,
    data,
    locale: 'en',
    status: 'published',
  });
  strapi.log.info('[seed] Membership apply link created (set the URL in CMS: Membership — Apply Link)');
}

// ─── Membership Payment & Channels (Single Type) ─────────────────────────────

// Bank transfer details and application channels shown on the Membership page.
// Initial values migrated from the old site (https://ecti-thailand.org/membership/);
// editors can update them in CMS → "Membership — Payment & Channels".
async function seedMembershipPayment(strapi: Core.Strapi) {
  const existing = await (strapi.documents('api::membership-payment.membership-payment') as any).findFirst({ locale: 'th' });
  if (existing?.account_number) return;

  const th = {
    bank_name: 'ธนาคารกสิกรไทย (KBANK)',
    bank_branch: 'สาขาคลองหลวง',
    account_name: 'สมาคม ECTI',
    account_number: '178-2-95444-6',
    swift_code: 'KASITHBK',
    payment_email: 'ecti.payment@gmail.com',
    online_portal_url: 'https://member.ecti-thailand.org',
    note: 'การสมัครจะได้รับการยืนยันเมื่อสมาคมได้รับชำระเงินเรียบร้อยแล้วเท่านั้น',
  };
  const en = {
    bank_name: 'KASIKORNBANK PCL (KBANK)',
    bank_branch: 'Khlong Luang Branch',
    account_name: 'ECTI Association',
    note: 'Registration is confirmed only upon receipt of payment.',
  };

  const doc = await strapi.documents('api::membership-payment.membership-payment').create({
    data: th,
    locale: 'th',
    status: 'published',
  });
  await strapi.documents('api::membership-payment.membership-payment').update({
    documentId: doc.documentId,
    data: en,
    locale: 'en',
    status: 'published',
  });
  strapi.log.info('[seed] Membership payment created');
}

// ─── Membership ECTI Credits (Single Type) ───────────────────────────────────

// Concise summary of the ECTI Credits system (condensed from the old site).
// Editors can refine the wording in CMS → "Membership — ECTI Credits".
async function seedMembershipCredit(strapi: Core.Strapi) {
  const existing = await (strapi.documents('api::membership-credit.membership-credit') as any).findFirst({ locale: 'th' });
  if (existing?.title) return;

  const th = {
    title: 'ระบบ ECTI Credits',
    description:
      'สมาชิกสามารถสะสม ECTI Credits จากการมีส่วนร่วมในกิจกรรมและงานของสมาคม โดยเครดิตที่สะสมได้สามารถนำไปใช้ลดหย่อนหรือยกเว้นค่าธรรมเนียมสมาชิก แลกของที่ระลึกของสมาคม และใช้ประกอบการพิจารณาตำแหน่งต่าง ๆ เช่น กรรมการหรือวิทยากรรับเชิญ ทั้งนี้เครดิตสามารถโอนย้ายได้เมื่อเปลี่ยนสถานะสมาชิก (เช่น จากสมาชิกนักศึกษาเป็นสมาชิกสามัญ) แต่ไม่สามารถโอนให้ผู้อื่นได้',
  };
  const en = {
    title: 'ECTI Credits',
    description:
      "Members earn ECTI Credits by contributing to the association's activities and work. Credits can be used to reduce or waive membership fees, redeem association merchandise, and count toward consideration for roles such as committee member or invited speaker. Credits transfer when a member changes status (for example, from student to regular member) but cannot be transferred to another person.",
  };

  const doc = await strapi.documents('api::membership-credit.membership-credit').create({
    data: th,
    locale: 'th',
    status: 'published',
  });
  await strapi.documents('api::membership-credit.membership-credit').update({
    documentId: doc.documentId,
    data: en,
    locale: 'en',
    status: 'published',
  });
  strapi.log.info('[seed] Membership credits created');
}

// ─── Membership Documents (Collection Type) ──────────────────────────────────

// Placeholder rows for the downloadable membership documents. Editors attach the
// actual PDF (field "file") and publish in CMS → "Membership — Document".
// Rows without a file or link are hidden on the front.
async function seedMembershipDocuments(strapi: Core.Strapi) {
  const docs = [
    { key: 'application-form', order: 1, th: 'ใบสมัครสมาชิก', en: 'Membership Application Form' },
    { key: 'renewal-form', order: 2, th: 'ใบต่ออายุสมาชิก', en: 'Membership Renewal Form' },
    { key: 'constitution', order: 3, th: 'ข้อบังคับสมาคม', en: 'Association Constitution' },
  ];

  for (const d of docs) {
    const found = await strapi.db
      .query('api::membership-document.membership-document')
      .findOne({ where: { key: d.key } });
    if (found) continue; // already seeded — don't clobber uploaded files

    const doc = await strapi.documents('api::membership-document.membership-document').create({
      data: { key: d.key, title: d.th, order: d.order },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::membership-document.membership-document').update({
      documentId: doc.documentId,
      data: { title: d.en },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Membership documents created');
}
