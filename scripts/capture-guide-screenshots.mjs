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

/**
 * Shot list derived from docs/user-guide-audit.md ## Screenshot Shot List.
 * Each entry: { slug, role, path, viewport, login, prep? }
 *   - login: demo email string, or null for unauthenticated pages.
 *   - prep:  string comment describing manual/seed prep needed (not executed by this script).
 */
const SHOTS = [
  // ── Unauthenticated ─────────────────────────────────────────────────────────
  {
    slug: 'login-page',
    role: 'unauth',
    path: '/login',
    viewport: 'desktop',
    login: null,
    // prep: none
  },
  {
    slug: 'forgot-reset-password',
    role: 'unauth',
    path: '/forgot-password',
    viewport: 'desktop',
    login: null,
    // prep: none
  },
  {
    slug: 'signup-screen',
    role: 'unauth',
    path: '/signup',
    viewport: 'desktop',
    login: null,
    // prep: none
  },
  {
    slug: 'student-join-form',
    role: 'unauth',
    path: '/entrar/DEMO',
    viewport: 'desktop',
    login: null,
    // prep: Enter a valid academy join code in /signup to land on /entrar/:code
  },

  // ── Student (pending / awaiting approval) ───────────────────────────────────
  {
    slug: 'aguardando-screen',
    role: 'student',
    path: '/aguardando',
    viewport: 'desktop',
    login: STUDENT_PENDING,
    // prep: none — lucas.branca.pending@demo.pgt has status='pending'
  },

  // ── Instructor — dashboard & student management ──────────────────────────────
  {
    slug: 'dashboard-instructor',
    role: 'instructor',
    path: '/',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none
  },
  {
    slug: 'dashboard-student-banner',
    role: 'student',
    path: '/',
    viewport: 'desktop',
    login: STUDENT_OVERDUE,
    // prep: pedro.branca.overdue@demo.pgt has overdue payments seeded; shows destructive red banner
  },
  {
    slug: 'pending-students',
    role: 'instructor',
    path: '/pending',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none — lucas.branca.pending@demo.pgt card should be visible
  },
  {
    slug: 'students-list',
    role: 'instructor',
    path: '/students',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none
  },
  {
    slug: 'student-detail-plan',
    role: 'instructor',
    path: '/students',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: Click on a student who has a plan assigned (e.g., João Azul / joao.azul@demo.pgt)
    //       to land on /students/:id. This script captures /students; deep-link requires the UUID.
  },

  // ── Instructor — billing ─────────────────────────────────────────────────────
  {
    slug: 'billing-overdue',
    role: 'instructor',
    path: '/billing',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none — pedro.branca.overdue@demo.pgt appears in Inadimplentes tab
  },
  {
    slug: 'billing-plans',
    role: 'instructor',
    path: '/billing/plans',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none
  },
  {
    slug: 'billing-payments',
    role: 'instructor',
    path: '/billing/payments',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none
  },

  // ── Instructor — notification bell ──────────────────────────────────────────
  {
    slug: 'notification-bell',
    role: 'instructor',
    path: '/',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: Ensure at least one student has an overdue payment (seeded) so badge appears;
    //       open the bell dropdown before the screenshot is captured.
  },

  // ── Marketplace ─────────────────────────────────────────────────────────────
  {
    slug: 'marketplace-products',
    role: 'instructor',
    path: '/marketplace',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none
  },
  {
    slug: 'marketplace-order',
    role: 'student',
    path: '/marketplace',
    viewport: 'desktop',
    login: STUDENT_AZUL,
    // prep: none — shows "Solicitar" button directly on each product card
  },
  {
    slug: 'marketplace-orders',
    role: 'instructor',
    path: '/marketplace/orders',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none
  },

  // ── Gamification ─────────────────────────────────────────────────────────────
  {
    slug: 'gamification-seasons',
    role: 'instructor',
    path: '/gamification/seasons',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: Click "Criar Temporada" to open the creation dialog before screenshot
  },
  {
    slug: 'gamification-results-instructor',
    role: 'instructor',
    path: '/gamification/results',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none
  },
  {
    slug: 'gamification-results-student',
    role: 'student',
    path: '/gamification/results',
    viewport: 'desktop',
    login: STUDENT_AZUL,
    // prep: Click "Enviar Resultado" tab before screenshot
  },
  {
    slug: 'gamification-leaderboard',
    role: 'instructor',
    path: '/gamification',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none
  },
  {
    slug: 'gamification-profile',
    role: 'student',
    path: '/gamification/profile',
    viewport: 'desktop',
    login: STUDENT_AZUL,
    // prep: none
  },

  // ── Totem (mobile) ───────────────────────────────────────────────────────────
  {
    slug: 'totem-page',
    role: 'instructor',
    path: '/totem',
    viewport: 'mobile',
    login: INSTRUCTOR,
    // prep: none
  },

  // ── Classes ──────────────────────────────────────────────────────────────────
  {
    slug: 'classes-student-checkin',
    role: 'student',
    path: '/classes',
    viewport: 'desktop',
    login: STUDENT_AZUL,
    // prep: Wait for or mock an active class time window to show Check-in and QR Code buttons
  },
  {
    slug: 'checkin-history',
    role: 'instructor',
    path: '/classes/history',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: Click "Histórico de Presença" tab
  },
  // checkin-scan: intentionally not captured. The page is a QR-redemption
  // landing that requires a `?token=...` from a totem scan; without one it
  // sits in a loading state. The student guide describes the flow in text.

  // ── Tournaments ──────────────────────────────────────────────────────────────
  {
    slug: 'tournaments-instructor',
    role: 'instructor',
    path: '/tournaments',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: Click "Ver Inscritos" on a tournament to show inline roster table
  },
  {
    slug: 'tournaments-student',
    role: 'student',
    path: '/tournaments',
    viewport: 'desktop',
    login: STUDENT_AZUL,
    // prep: Click "Inscrever-se" on a tournament to show sign-up dialog
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  {
    slug: 'settings-location',
    role: 'instructor',
    path: '/settings',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none
  },

  // ── Classes — instructor management ─────────────────────────────────────────
  {
    slug: 'classes-create',
    role: 'instructor',
    path: '/classes',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: Click "Criar Aula" button to open the create class dialog before screenshot
  },
  {
    slug: 'classes-edit-delete',
    role: 'instructor',
    path: '/classes',
    viewport: 'desktop',
    login: INSTRUCTOR,
    // prep: none — class cards with pencil (edit) and trash (delete) icon buttons
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
  });

  try {
    if (shot.login) {
      await impersonate(context, shot.login);
    }

    const page = await context.newPage();
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

  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
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
