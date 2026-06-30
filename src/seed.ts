// @ts-nocheck
import type { Core } from '@strapi/strapi';

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
  await seedContact(strapi);

  strapi.log.info('[seed] Done.');
}

// ─── Tags ────────────────────────────────────────────────────────────────────

async function seedTags(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::tag.tag') > 0) return;

  const tags = [
    { th: 'ประกาศ', en: 'Announcements' },
    { th: 'เรียกรับบทความ', en: 'Call for Papers' },
    { th: 'รางวัล', en: 'Awards' },
    { th: 'สิ่งพิมพ์', en: 'Publications' },
    { th: 'บทความ', en: 'Article' },
  ];

  for (const t of tags) {
    const doc = await strapi.documents('api::tag.tag').create({
      data: { name: t.th },
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
    },
  ];

  for (const p of posts) {
    const doc = await strapi.documents('api::news-post.news-post').create({
      data: { slug: p.slug, title: p.th.title, summary: p.th.summary, body: p.th.body, author: p.author, read_time_min: p.read_time_min },
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

async function seedBoardMembers(strapi: Core.Strapi) {
  if (await countDocuments(strapi, 'api::board-member.board-member') > 0) return;

  const members = [
    { th: { name: 'ศ.ดร. สมชาย วิทยากร', role: 'นายกสมาคม', institution: 'จุฬาลงกรณ์มหาวิทยาลัย' }, en: { name: 'Prof. Dr. Somchai Wittayakorn', role: 'President', institution: 'Chulalongkorn University' }, committee: 'exec' },
    { th: { name: 'รศ.ดร. สุนีย์ รัตนวงศ์', role: 'อุปนายกฝ่ายวิชาการ', institution: 'มหาวิทยาลัยเกษตรศาสตร์' }, en: { name: 'Assoc. Prof. Dr. Sunee Rattanawong', role: 'Vice President (Academic)', institution: 'Kasetsart University' }, committee: 'exec' },
    { th: { name: 'ผศ.ดร. ประวิทย์ ชัยสกุล', role: 'เลขาธิการ', institution: 'มหาวิทยาลัยมหิดล' }, en: { name: 'Asst. Prof. Dr. Prawit Chaisakul', role: 'Secretary General', institution: 'Mahidol University' }, committee: 'exec' },
    { th: { name: 'รศ.ดร. อนุชา ทองเจริญ', role: 'เหรัญญิก', institution: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี' }, en: { name: 'Assoc. Prof. Dr. Anucha Thongcharoen', role: 'Treasurer', institution: 'KMUTT' }, committee: 'exec' },
    { th: { name: 'ศ.ดร. วีระ สุขประเสริฐ', role: 'ประธานอนุกรรมการวิชาการ', institution: 'มหาวิทยาลัยขอนแก่น' }, en: { name: 'Prof. Dr. Veera Sukprasert', role: 'Chair, Academic Committee', institution: 'Khon Kaen University' }, committee: 'academic' },
    { th: { name: 'รศ.ดร. ชาญณรงค์ พรรุ่งโรจน์', role: 'กรรมการวิชาการ', institution: 'มหาวิทยาลัยเชียงใหม่' }, en: { name: 'Assoc. Prof. Dr. Channarong Pornrungrojn', role: 'Academic Committee Member', institution: 'Chiang Mai University' }, committee: 'academic' },
    { th: { name: 'ผศ.ดร. ภาวิณี ศรีสุข', role: 'กรรมการวิชาการ', institution: 'มหาวิทยาลัยสงขลานครินทร์' }, en: { name: 'Asst. Prof. Dr. Pawinee Srisuk', role: 'Academic Committee Member', institution: 'Prince of Songkla University' }, committee: 'academic' },
    { th: { name: 'ศ.ดร. ธีระ อภิวัฒน์กุล', role: 'บรรณาธิการบริหาร ECTI-EEC', institution: 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง' }, en: { name: 'Prof. Dr. Theera Apivatanakul', role: 'Editor-in-Chief, ECTI-EEC', institution: 'KMITL' }, committee: 'publications' },
    { th: { name: 'รศ.ดร. นลินรัตน์ กิตติวงศ์', role: 'บรรณาธิการบริหาร ECTI-CIT', institution: 'มหาวิทยาลัยธรรมศาสตร์' }, en: { name: 'Assoc. Prof. Dr. Nalinrat Kittiwong', role: 'Editor-in-Chief, ECTI-CIT', institution: 'Thammasat University' }, committee: 'publications' },
  ];

  for (const m of members) {
    const doc = await strapi.documents('api::board-member.board-member').create({
      data: { name: m.th.name, role: m.th.role, institution: m.th.institution, committee: m.committee as any },
      locale: 'th',
      status: 'published',
    });
    await strapi.documents('api::board-member.board-member').update({
      documentId: doc.documentId,
      data: { name: m.en.name, role: m.en.role, institution: m.en.institution },
      locale: 'en',
      status: 'published',
    });
  }
  strapi.log.info('[seed] Board members created');
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
  if (await countDocuments(strapi, 'api::member-type.member-type') > 0) return;

  const types = [
    { th: { type: 'สมาชิกสามัญ', eligibility: 'ผู้สำเร็จการศึกษาระดับปริญญาตรีขึ้นไปในสาขาที่เกี่ยวข้อง หรือผู้ที่ทำงานในสาขาวิศวกรรมและเทคโนโลยี' }, en: { type: 'Regular Member', eligibility: 'Persons with a bachelor\'s degree or higher in a related field, or those working in engineering and technology.' }, annual_fee: 500, lifetime_fee: 5000 },
    { th: { type: 'สมาชิกวิสามัญ', eligibility: 'นิสิตนักศึกษาที่กำลังศึกษาในระดับปริญญาตรี โท หรือเอก ในสาขาที่เกี่ยวข้อง' }, en: { type: 'Associate Member', eligibility: 'Students currently enrolled in a bachelor\'s, master\'s, or doctoral program in a related field.' }, annual_fee: 200, lifetime_fee: 0 },
    { th: { type: 'สมาชิกกิตติมศักดิ์', eligibility: 'บุคคลผู้ทรงคุณวุฒิที่ได้รับการเชิดชูเกียรติโดยมติของคณะกรรมการสมาคม' }, en: { type: 'Honorary Member', eligibility: 'Distinguished individuals honored by resolution of the association\'s board of directors.' }, annual_fee: 0, lifetime_fee: 0 },
    { th: { type: 'สมาชิกนิติบุคคล', eligibility: 'บริษัท องค์กร หรือหน่วยงานที่ดำเนินกิจการในสาขาที่เกี่ยวข้องกับพันธกิจของสมาคม' }, en: { type: 'Corporate Member', eligibility: 'Companies, organizations, or agencies operating in fields related to the association\'s mission.' }, annual_fee: 5000, lifetime_fee: 0 },
  ];

  for (const t of types) {
    const doc = await strapi.documents('api::member-type.member-type').create({
      data: { type: t.th.type, eligibility: t.th.eligibility, annual_fee: t.annual_fee, lifetime_fee: t.lifetime_fee },
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
