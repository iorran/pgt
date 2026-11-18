// scripts/capture-guide-screenshots.mjs
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const WEB_URL = process.env.PGT_WEB_URL ?? 'http://localhost:5173';
const API_URL = process.env.PGT_API_URL ?? 'http://localhost:3000';
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'assets', 'user-guide');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

// Demo user emails — must match apps/api/src/db/seed-guide.ts exports
const INSTRUCTOR = 'instrutor@demo.pgt';
const STUDENT_AZUL = 'joao.azul@demo.pgt';
const STUDENT_ROXA = 'maria.roxa@demo.pgt';
const STUDENT_OVERDUE = 'pedro.branca.overdue@demo.pgt';
const STUDENT_PENDING = 'lucas.branca.pending@demo.pgt';
const RESPONSIBLE = 'paula.lima@demo.pgt';
const JOIN_CODE = 'PGT-DEMO-001';

/**
 * Every image the user guides reference, and nothing else. Data comes from
 * `npm run db:seed:guide` (apps/api/src/db/seed-guide.ts).
 * Each entry: { slug, role, path, viewport, login, action?, permissions?, stub? }
 *   - login:  demo email, or null for unauthenticated pages.
 *   - action: async (page) => void run before the screenshot (open a dialog, scroll, …).
 *   - stub:   { urlGlob: json } API responses to fake for this shot.
 */
// The guide seed puts a Seminar 3 days from now (inside the 7-day strip) and one ~25 days out
// (outside it). The strip's day button names the full date and ends in "tem seminário".
const SEMINAR_DAY = /tem seminário$/;
const TEACHER = STUDENT_ROXA; // Maria teaches No-Gi Noite: Perfil → Meu repasse

const scrollTo = (text) => async (page) => {
  await page
    .getByText(text, { exact: true })
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
};

const openDialog = (name) => async (page) => {
  await page.getByRole('button', { name }).first().click();
  await page.getByRole('dialog').waitFor();
};

const SHOTS = [
  // ── Unauthenticated ─────────────────────────────────────────────────────────
  { slug: 'login-page', role: 'unauth', path: '/login', viewport: 'desktop', login: null },
  { slug: 'forgot-reset-password', role: 'unauth', path: '/forgot-password', viewport: 'desktop', login: null },
  { slug: 'signup-screen', role: 'unauth', path: '/signup', viewport: 'desktop', login: null },
  { slug: 'student-join-form', role: 'unauth', path: `/entrar/${JOIN_CODE}`, viewport: 'desktop', login: null },

  // ── Student ─────────────────────────────────────────────────────────────────
  { slug: 'aguardando-screen', role: 'student', path: '/aguardando', viewport: 'mobile', login: STUDENT_PENDING },
  { slug: 'profile-picker', role: 'student', path: '/perfis', viewport: 'mobile', login: RESPONSIBLE },
  { slug: 'classes-student-checkin', role: 'student', path: '/classes', viewport: 'mobile', login: STUDENT_AZUL },
  {
    slug: 'seminar-student',
    role: 'student',
    path: '/classes',
    viewport: 'mobile',
    login: STUDENT_AZUL,
    action: async (page) => {
      await page.getByRole('button', { name: SEMINAR_DAY }).click();
      await page.getByText('Passagem de guarda').first().scrollIntoViewIfNeeded();
    },
  },
  {
    slug: 'seminars-tab-student',
    role: 'student',
    path: '/classes/seminars',
    viewport: 'mobile',
    login: STUDENT_AZUL,
    action: (page) => page.getByText('Leg locks').waitFor(),
  },
  // Chromium's fake camera stands in for a real one.
  { slug: 'checkin-scanner', role: 'student', path: '/checkin', viewport: 'mobile', login: STUDENT_AZUL, permissions: ['camera'] },
  { slug: 'dashboard-student-banner', role: 'student', path: '/me', viewport: 'mobile', login: STUDENT_OVERDUE },
  { slug: 'student-billing', role: 'student', path: '/me/billing', viewport: 'mobile', login: STUDENT_AZUL },
  { slug: 'student-hub', role: 'student', path: '/me', viewport: 'mobile', login: TEACHER },
  { slug: 'my-payout', role: 'student', path: '/me/payout', viewport: 'mobile', login: TEACHER },
  { slug: 'gamification-profile', role: 'student', path: '/gamification/profile', viewport: 'mobile', login: STUDENT_AZUL },
  { slug: 'marketplace-order', role: 'student', path: '/marketplace', viewport: 'mobile', login: STUDENT_AZUL },
  {
    slug: 'tournaments-student',
    role: 'student',
    path: '/tournaments',
    viewport: 'mobile',
    login: STUDENT_AZUL,
    action: openDialog('Inscrever-se'),
  },

  // ── Owner — getting started & students ─────────────────────────────────────
  { slug: 'phone-menu', role: 'instructor', path: '/', viewport: 'mobile', login: INSTRUCTOR, action: openDialog('Mais') },
  { slug: 'settings-location', role: 'instructor', path: '/settings', viewport: 'desktop', login: INSTRUCTOR },
  { slug: 'settings-modalities', role: 'instructor', path: '/settings', viewport: 'desktop', login: INSTRUCTOR, action: scrollTo('Modalidades') },
  { slug: 'pending-students', role: 'instructor', path: '/pending', viewport: 'desktop', login: INSTRUCTOR },
  { slug: 'students-list', role: 'instructor', path: '/students', viewport: 'desktop', login: INSTRUCTOR },
  {
    slug: 'student-detail',
    role: 'instructor',
    path: '/students',
    viewport: 'desktop',
    login: INSTRUCTOR,
    action: async (page) => {
      await page.getByRole('link', { name: 'João Silva' }).filter({ visible: true }).first().click();
      await page.getByText('Salvar mensalidade').waitFor();
    },
  },
  { slug: 'families-tab', role: 'instructor', path: '/students/families', viewport: 'desktop', login: INSTRUCTOR },
  { slug: 'family-dialog', role: 'instructor', path: '/students/families', viewport: 'desktop', login: INSTRUCTOR, action: openDialog('Editar') },

  // ── Owner — dashboard (the owner's home page) ──────────────────────────────
  { slug: 'owner-dashboard-overview', role: 'instructor', path: '/', viewport: 'desktop', login: INSTRUCTOR },
  { slug: 'owner-aderencia-chart', role: 'instructor', path: '/?period=month', viewport: 'desktop', login: INSTRUCTOR },
  {
    slug: 'owner-classes-expanded',
    role: 'instructor',
    path: '/?period=month',
    viewport: 'desktop',
    login: INSTRUCTOR,
    action: async (page) => {
      const row = page.getByRole('button', { name: /No-Gi Noite/ }).first();
      await row.click();
      await page.getByText('Presentes').first().waitFor();
      await row.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    },
  },
  {
    slug: 'owner-students-list',
    role: 'instructor',
    path: '/',
    viewport: 'desktop',
    login: INSTRUCTOR,
    action: async (page) => {
      const row = page.getByRole('button', { name: /Ana Costa/ }).first();
      await row.click();
      await page.getByText('Melhor').first().waitFor();
      await page.getByRole('button', { name: /^Todos/ }).last().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    },
  },

  // ── Owner — classes, seminars, check-in ────────────────────────────────────
  { slug: 'classes-edit-delete', role: 'instructor', path: '/classes', viewport: 'mobile', login: INSTRUCTOR },
  { slug: 'classes-create', role: 'instructor', path: '/classes', viewport: 'desktop', login: INSTRUCTOR, action: openDialog('Criar aula') },
  {
    slug: 'class-teacher-picker',
    role: 'instructor',
    path: '/classes',
    viewport: 'mobile',
    login: INSTRUCTOR,
    action: async (page) => {
      await openDialog('Criar aula')(page);
      await page.getByLabel('Professor', { exact: true }).click();
      await page.getByText('Faixas roxa, marrom e preta').waitFor();
    },
  },
  { slug: 'seminars-tab', role: 'instructor', path: '/classes/seminars', viewport: 'mobile', login: INSTRUCTOR, action: (page) => page.getByText('Leg locks').waitFor() },
  { slug: 'seminar-create', role: 'instructor', path: '/classes/seminars', viewport: 'mobile', login: INSTRUCTOR, action: openDialog('Criar seminário') },
  {
    slug: 'seminar-page',
    role: 'instructor',
    path: '/classes/seminars',
    viewport: 'mobile',
    login: INSTRUCTOR,
    action: async (page) => {
      await page.getByRole('link', { name: /Passagem de guarda/ }).click();
      await page.getByText('Marta Sousa').waitFor();
    },
  },
  {
    slug: 'seminar-participant',
    role: 'instructor',
    path: '/classes/seminars',
    viewport: 'mobile',
    login: INSTRUCTOR,
    action: async (page) => {
      await page.getByRole('link', { name: /Passagem de guarda/ }).click();
      await page.getByRole('button', { name: /Marta Sousa/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click();
      await page.getByText(/Já pagou/).waitFor();
    },
  },
  { slug: 'checkin-history', role: 'instructor', path: '/classes/history', viewport: 'mobile', login: INSTRUCTOR },
  { slug: 'totem-page', role: 'instructor', path: '/totem', viewport: 'desktop', login: INSTRUCTOR },
  // Nothing open: the API is stubbed to return no QR codes, so the totem shows the next class and the clock.
  {
    slug: 'totem-empty',
    role: 'instructor',
    path: '/totem',
    viewport: 'desktop',
    login: INSTRUCTOR,
    stub: { '**/api/checkins/tokens': [] },
    action: (page) => page.getByText('Nenhuma aula no momento').waitFor(),
  },

  // ── Owner — Financeiro ─────────────────────────────────────────────────────
  { slug: 'billing-overdue', role: 'instructor', path: '/billing', viewport: 'desktop', login: INSTRUCTOR },
  {
    slug: 'billing-payments',
    role: 'instructor',
    path: '/billing/payments',
    viewport: 'desktop',
    login: INSTRUCTOR,
    action: async (page) => {
      await page.locator('#payment-student').click();
      await page.locator('#payment-student').fill('a');
      await page.getByRole('option').first().waitFor();
    },
  },
  { slug: 'billing-balance', role: 'instructor', path: '/billing/balance', viewport: 'desktop', login: INSTRUCTOR },
  { slug: 'billing-expenses', role: 'instructor', path: '/billing/expenses', viewport: 'desktop', login: INSTRUCTOR },
  { slug: 'payout-sheets', role: 'instructor', path: '/billing/payouts', viewport: 'desktop', login: INSTRUCTOR },
  {
    slug: 'payout-sheet',
    role: 'instructor',
    path: '/billing/payouts',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // The draft No-Gi sheet starts open on the tab; scroll to its rows.
    action: async (page) => {
      await page.getByText('Total do repasse').first().waitFor();
      // Put its header just under the sticky top bar.
      await page.getByRole('button', { name: /^No-Gi Noite/ }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -76));
    },
  },
  {
    slug: 'notification-bell',
    role: 'instructor',
    path: '/',
    viewport: 'desktop',
    login: INSTRUCTOR,
    action: async (page) => {
      await page.getByRole('button', { name: /^Notificações/ }).first().click();
      await page.getByText('Enviar lembrete').first().waitFor();
    },
  },

  // ── Owner — shop, ranking, tournaments ─────────────────────────────────────
  { slug: 'marketplace-products', role: 'instructor', path: '/marketplace', viewport: 'desktop', login: INSTRUCTOR },
  { slug: 'marketplace-orders', role: 'instructor', path: '/marketplace/orders', viewport: 'desktop', login: INSTRUCTOR },
  { slug: 'gamification-seasons', role: 'instructor', path: '/gamification/seasons', viewport: 'desktop', login: INSTRUCTOR, action: openDialog('Criar temporada') },
  {
    slug: 'gamification-results-instructor',
    role: 'instructor',
    path: '/gamification/results',
    viewport: 'desktop',
    login: INSTRUCTOR,
    action: (page) => page.getByText('Copa Pontinha').first().waitFor(),
  },
  { slug: 'gamification-leaderboard', role: 'instructor', path: '/gamification', viewport: 'desktop', login: INSTRUCTOR },
  {
    slug: 'student-points',
    role: 'instructor',
    path: '/gamification',
    viewport: 'desktop',
    login: INSTRUCTOR,
    action: async (page) => {
      await page.getByText('João Silva').first().click();
      await page.getByText('Mafra Cup').first().waitFor();
    },
  },
  {
    slug: 'tournaments-instructor',
    role: 'instructor',
    path: '/tournaments',
    viewport: 'desktop',
    login: INSTRUCTOR,
    action: async (page) => {
      await page.getByRole('button', { name: 'Ver inscritos' }).first().click();
      await page.getByText('Ana Costa').waitFor();
    },
  },
];

async function impersonate(context, email) {
  const page = await context.newPage();
  const response = await page.goto(
    // Call through the Vite dev proxy so the cookie is scoped to the web origin.
    // Hitting API_URL directly would set the cookie on localhost:3000 which the
    // browser will not send with the web app's same-origin /api/auth/get-session.
    `${WEB_URL}/api/dev/impersonate?email=${encodeURIComponent(email)}`,
  );
  if (!response || !response.ok()) {
    throw new Error(
      `impersonate failed for ${email}: HTTP ${response?.status()}`,
    );
  }
  await page.close();
}

async function captureShot(browser, shot) {
  const context = await browser.newContext({
    viewport: shot.viewport === 'mobile' ? MOBILE : DESKTOP,
    locale: 'pt-BR',
    timezoneId: 'Europe/Lisbon',
    baseURL: WEB_URL,
    ...(shot.permissions?.length ? { permissions: shot.permissions } : {}),
  });

  try {
    if (shot.login) {
      await impersonate(context, shot.login);
    }

    const page = await context.newPage();
    for (const [pattern, body] of Object.entries(shot.stub ?? {})) {
      await page.route(pattern, (route) => route.fulfill({ json: body }));
    }
    await page.goto(`${WEB_URL}${shot.path}`);
    // Wait for DOM content (always works). Some pages (e.g., /totem) poll on
    // a timer so `networkidle` never fires — fall back to domcontentloaded +
    // a longer settle delay for those.
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    try {
      await page.waitForLoadState('networkidle', { timeout: 5_000 });
    } catch {
      // Polling pages never idle; proceed with a longer settle.
    }
    if (shot.action) {
      await shot.action(page);
    }
    await page.waitForTimeout(1_000);

    const outPath = path.join(
      OUT_DIR,
      shot.role.toLowerCase(),
      `${shot.slug}.png`,
    );
    await mkdir(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  ✓ ${shot.role.toLowerCase()}/${shot.slug}.png`);
    await page.close();
  } finally {
    await context.close();
  }
}

async function main() {
  console.log(`→ Capturing ${SHOTS.length} screenshots`);
  console.log(`→ Web: ${WEB_URL}`);
  console.log(`→ API: ${API_URL}`);
  console.log(`→ Out: ${OUT_DIR}`);

  // Fake camera for the check-in scanner. ONLY=slug,slug captures just those shots.
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const only = process.env.ONLY?.split(',');
  try {
    for (const shot of SHOTS.filter((x) => !only || only.includes(x.slug))) {
      try {
        await captureShot(browser, shot);
      } catch (err) {
        console.error(`  ✗ ${shot.role}/${shot.slug}: ${err.message}`);
        // Keep going — one failing shot shouldn't kill the run.
      }
    }
  } finally {
    await browser.close();
  }
  console.log('✓ Capture complete');
}

main().catch((e) => {
  console.error('✗ Capture failed:', e);
  process.exit(1);
});
