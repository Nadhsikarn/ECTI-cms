#!/usr/bin/env node
/**
 * Shows what the newsletter's API key can actually see in Brevo.
 *
 * Exists because of a specific confusion that is hard to reason your way out
 * of: the CMS reported campaigns created successfully — it only sets
 * newsletter_sent after Brevo answers with an id — while nobody could find
 * them in the web app. Both can be true at once. An API key belongs to one
 * Brevo account and a browser session belongs to another, and neither screen
 * mentions the existence of the other.
 *
 * So this asks the same key the same question, and says whose account answered
 * before it says anything else. If that is not the account open in the browser,
 * that is the whole answer.
 *
 *   BREVO_API_KEY=xkeysib-... node scripts/brevo-campaigns.mjs
 *
 * Read-only. It lists; it never creates, edits or sends anything.
 */

const API = 'https://api.brevo.com/v3';
const KEY = process.env.BREVO_API_KEY?.trim();

if (!KEY) {
  console.error('BREVO_API_KEY is not set.\n');
  console.error('Use the same value the CMS uses — Strapi Cloud → Settings → Variables.');
  process.exit(1);
}

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'api-key': KEY, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const hint = res.status === 401 ? ' — the key is wrong or has been revoked.' : '';
    throw new Error(`GET ${path} → ${res.status}${hint}\n${JSON.stringify(body)}`);
  }
  return body;
}

const rule = (char = '─') => console.log(char.repeat(64));

async function main() {
  // Whose account, first and alone: nothing below means anything until you know
  // whose data you are looking at.
  const account = await get('/account');
  rule('=');
  console.log('This key belongs to');
  rule('=');
  console.log(`  Company   ${account.companyName ?? '(none)'}`);
  console.log(`  Login     ${account.email ?? '(unknown)'}`);
  console.log('\n  If that is not the account open in your browser, the campaigns');
  console.log('  are in this one and the browser is showing a different account.\n');

  const senders = await get('/senders');
  rule();
  console.log('Verified senders');
  rule();
  for (const s of senders.senders ?? []) {
    console.log(`  ${s.active ? 'ready   ' : 'PENDING '} ${s.email}   ${s.name ?? ''}`);
  }
  if (!senders.senders?.length) console.log('  None. A campaign can be created but never sent.');
  console.log('\n  NEWSLETTER_SENDER_EMAIL has to be one of these, and ready rather');
  console.log('  than pending — Brevo refuses an unverified sender at send time,');
  console.log('  not when the campaign is created.\n');

  const lists = await get('/contacts/lists?limit=50');
  rule();
  console.log('Contact lists');
  rule();
  for (const l of lists.lists ?? []) {
    console.log(
      `  id ${String(l.id).padStart(3)}  ${String(l.totalSubscribers).padStart(5)} subscribers  ${l.name}`
    );
  }
  if (!lists.lists?.length) console.log('  None.');
  console.log('\n  BREVO_LIST_ID must be one of these ids — the same one on the front,');
  console.log('  which is where subscribers are added.\n');

  const campaigns = await get('/emailCampaigns?limit=25&sort=desc');
  rule();
  console.log(`Email campaigns (${campaigns.count ?? 0} in total, newest first)`);
  rule();
  if (!campaigns.campaigns?.length) {
    console.log('  None. Nothing has ever been created with this key.');
  }
  for (const c of campaigns.campaigns ?? []) {
    console.log(`\n  #${c.id}  [${c.status}]  ${c.subject || c.name}`);
    console.log(`      created  ${(c.createdAt ?? '').slice(0, 16).replace('T', ' ')}`);
    console.log(`      to lists ${(c.recipients?.lists ?? []).join(', ') || '(none)'}`);
    console.log(`      open at  https://app.brevo.com/campaigns/edit/${c.id}`);
  }
  console.log('\nStatus "draft" means it is waiting for a person to send it.');
  console.log('Nothing above has been mailed unless its status says so.\n');
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exitCode = 1;
});
