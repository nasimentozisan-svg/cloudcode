import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-cloudcode/53abec74-2f8d-5013-a098-40ad90f54d14/scratchpad/screenshots';
const BASE = 'http://localhost:3100';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function click(locator) {
  await locator.evaluate((el) => el.click());
}
async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('shot:', name);
}

// Submits a form and confirms success by checking for expected text. If a
// click doesn't seem to register (this sandboxed browser occasionally
// drops the first dispatch), a full page reload resets hydration state
// before the form is refilled and retried - just re-clicking the same
// element repeatedly does not reliably recover.
//
// After clicking, this actively POLLS for checkText (up to pollMs) instead
// of a single fixed sleep + one-shot check. A fixed sleep races against
// slightly-slower-than-usual navigations: if the real redirect lands just
// after the sleep+check, the loop would reload and resubmit the same form
// - which is harmless for idempotent actions, but for a guarded one-shot
// action like admin setup, the resubmission hits a real "already exists"
// error that no further reload can ever turn back into success. Polling
// for the actual success condition removes that race entirely.
async function submitForm(page, url, fill, submitLocator, checkText, attempts = 6, pollMs = 6000) {
  await page.goto(url);
  for (let i = 0; i < attempts; i++) {
    // Check success BEFORE reloading/refilling - if a previous attempt
    // actually landed but we hadn't noticed yet, don't navigate away.
    const already = await page.locator('body').innerText().catch(() => '');
    if (already.includes(checkText)) return true;
    if (i > 0) await page.reload();
    await page.waitForTimeout(500);
    await fill();
    await click(submitLocator(page));
    const success = await page
      .waitForFunction((text) => document.body.innerText.includes(text), checkText, {
        timeout: pollMs,
      })
      .then(() => true)
      .catch(() => false);
    if (success) return true;
    if (process.env.DEMO_DEBUG) {
      const b = await page.locator('body').innerText().catch(() => '');
      console.log(`      [attempt ${i}] url=${page.url()}`);
      console.log(`      body=${b.slice(0, 400).replace(/\n/g, ' | ')}`);
    }
  }
  const final = await page.locator('body').innerText().catch(() => '');
  return final.includes(checkText);
}
async function login(page, email) {
  const ok = await submitForm(
    page,
    `${BASE}/login`,
    async () => {
      await page.fill('input[name=email]', email);
      await page.fill('input[name=password]', 'password123');
    },
    (p) => p.locator('button:has-text("ログイン")'),
    'マイプロフィール'
  );
  if (!ok) throw new Error(`login failed for ${email}`);
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
if (process.env.DEMO_DEBUG) {
  page.on('pageerror', (e) => console.log('  [PAGEERROR]', e.message));
  page.on('response', (r) => {
    if (r.request().method() === 'POST') console.log('  [POST]', r.status(), r.url());
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [CONSOLE ERROR]', m.text().slice(0, 200));
  });
}

// --- 1. setup admin ---
const setupOk = await submitForm(
  page,
  `${BASE}/setup`,
  async () => {
    await page.fill('input[name=name]', '西園寺 太郎');
    await page.check('input[name=categories][value=TOP_COACH]');
    await page.fill('input[name=email]', 'admin@example.com');
    await page.fill('input[name=password]', 'password123');
  },
  (p) => p.locator('button[type=submit]'),
  'メンバー一覧'
);
if (!setupOk) throw new Error('setup failed');
console.log('1. admin ready');

// --- 2. register players (names matching the real roster PDFs) ---
// Uses a fresh page per registration - handing off from the admin's page
// straight into a register form on the same page has been unreliable in
// this sandboxed browser; a brand-new page is not.
// NOTE: input[name=email] is type="email", which enforces the HTML living
// standard's ASCII-only local-part regex client-side. A Japanese-character
// local part (e.g. "鶴田文彦@example.com") fails that native constraint
// validation silently on click - no exception, no console error, no POST -
// which is exactly what caused every earlier registration attempt in this
// script to appear to do nothing. Use ASCII emails here.
async function selfRegister(name, email, categoryValue) {
  const regPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const ok = await submitForm(
    regPage,
    `${BASE}/register`,
    async () => {
      await regPage.fill('input[name=name]', name);
      await regPage.check(`input[name=categories][value=${categoryValue}]`);
      await regPage.fill('input[name=email]', email);
      await regPage.fill('input[name=password]', 'password123');
    },
    (p) => p.locator('button:has-text("登録する")'),
    'マイプロフィール',
    15
  );
  await regPage.close();
  if (!ok) throw new Error(`register failed for ${name}`);
  console.log('  registered', name);
}
await selfRegister('鶴田 文彦', 'tsuruta@example.com', 'SATELLITE_PLAYER'); // in roster_test.pdf
await selfRegister('柴田 響也', 'shibata@example.com', 'TOP_PLAYER'); // in roster_top.pdf
await selfRegister('富永 聖成', 'tominaga@example.com', 'U18_PLAYER'); // in roster_u18.pdf
console.log('2. players registered');

// --- 3. admin uploads real roster PDFs ---
await login(page, 'admin@example.com');
const uploadOk = await submitForm(
  page,
  `${BASE}/admin/cards`,
  async () => {
    await page.setInputFiles('input[name=rosters]', [
      '/tmp/roster_test.pdf',
      '/tmp/roster_top.pdf',
      '/tmp/roster_u18.pdf',
    ]);
  },
  (p) => p.locator('button:has-text("アップロードして自動紐付け")'),
  '自動で紐付け:', // colon distinguishes the result line from the static instructional text above the form, which also contains "自動で紐付け" (without a colon) and was matching immediately as a false positive
  4,
  15000 // PDF parsing (3 rosters with embedded images) takes longer than the default poll window
);
if (!uploadOk) throw new Error('upload failed');
console.log('3. RESULT:', await page.locator('p.text-emerald-700').innerText());
await shot(page, 'demo_01_admin_cards_result');

await page.goto(`${BASE}/admin`);
await page.waitForTimeout(1000);
await shot(page, 'demo_02_admin_member_list');

// --- 4. admin creates a schedule event for all categories ---
const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
const eventOk = await submitForm(
  page,
  `${BASE}/schedule/new`,
  async () => {
    await page.fill('input[name=title]', '合同練習');
    await page.fill('input[name=startAt]', future.toISOString().slice(0, 16));
    await page.fill('input[name=location]', '市営体育館');
    for (const cat of ['TOP_PLAYER', 'TOP_COACH', 'SATELLITE_PLAYER', 'U18_PLAYER']) {
      await page.check(`input[name=categories][value=${cat}]`);
    }
    await page.fill('textarea[name=notes]', '体育館シューズ・飲み物持参');
  },
  (p) => p.locator('button:has-text("予定を作成する")'),
  '今後の予定'
);
if (!eventOk) throw new Error('event creation failed');
console.log('4. schedule event created');
await shot(page, 'demo_03_schedule_admin');

// --- 5. each player logs in and responds ---
for (const email of ['tsuruta@example.com', 'shibata@example.com', 'tominaga@example.com']) {
  await login(page, email);
  await page.goto(`${BASE}/schedule`);
  await page.waitForTimeout(500);
  const btn = page.locator('button:has-text("出席")').first();
  if ((await btn.count()) > 0) {
    await click(btn);
    await page.waitForTimeout(1000);
  }
}
console.log('5. players responded');

await login(page, 'admin@example.com');
await page.goto(`${BASE}/schedule`);
await page.waitForTimeout(500);
await shot(page, 'demo_04_schedule_with_responses');

// --- 6. messaging: post in default + custom channel ---
await login(page, 'shibata@example.com');
await page.goto(`${BASE}/messages`);
await page.waitForTimeout(500);
await shot(page, 'demo_05_messages_channel_list');
await page.locator('a', { hasText: 'トップ' }).first().click();
await page.waitForTimeout(500);
const postOk = await submitForm(
  page,
  page.url(),
  async () => {
    await page.fill('textarea[name=body]', '合同練習、集合時間は10時集合でお願いします！');
  },
  (p) => p.locator('button:has-text("送信")'),
  '合同練習、集合時間'
);
if (!postOk) throw new Error('message post failed');
await shot(page, 'demo_06_messages_top_channel');

await login(page, 'admin@example.com');
const channelOk = await submitForm(
  page,
  `${BASE}/messages/new`,
  async () => {
    await page.fill('input[name=name]', 'コーチ連絡');
    await page.check('input[name=categories][value=TOP_COACH]');
    await page.check('input[name=categories][value=SATELLITE_COACH]');
    await page.check('input[name=categories][value=U18_COACH]');
  },
  (p) => p.locator('button:has-text("チャンネルを作成")'),
  'コーチ連絡'
);
if (!channelOk) throw new Error('channel creation failed');
console.log('6. messages posted, custom channel created');

// --- 7. dashboards, full picture ---
await login(page, 'tsuruta@example.com');
await page.goto(`${BASE}/dashboard`);
await page.waitForTimeout(500);
await shot(page, 'demo_07_player_dashboard_tsuruta');

await login(page, 'tominaga@example.com');
await page.goto(`${BASE}/dashboard`);
await page.waitForTimeout(500);
await shot(page, 'demo_08_player_dashboard_tominaga');

await login(page, 'admin@example.com');
await page.goto(`${BASE}/dashboard`);
await page.waitForTimeout(500);
await shot(page, 'demo_09_admin_dashboard');

await browser.close();
console.log('DEMO DONE');
