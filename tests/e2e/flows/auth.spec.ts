import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import {
  setupAcademy,
  cleanAcademy,
  createStudent,
  e2eDb,
  schema,
  type FixtureAcademy,
} from '../fixtures';
import { impersonateAs } from '../auth';
import { LoginPage } from '../pages/login-page';
import {
  SignupPage,
  ChooseRolePage,
  CriarAcademiaPage,
  EntrarPage,
} from '../pages/signup-page';
import { ForgotPasswordPage } from '../pages/forgot-password-page';

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

// ─── Test 1 ──────────────────────────────────────────────────────────────────

test('unauthenticated visit redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});

// ─── Test 2 ──────────────────────────────────────────────────────────────────

test('pending student lands on /aguardando', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(academy.id, { status: 'pending' });

  const context = await impersonateAs(browser, student.email);
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/aguardando/, { timeout: 10_000 });
  } finally {
    await context.close();
  }
});

// ─── Test 3 ──────────────────────────────────────────────────────────────────

test('instructor signup → create academy → dashboard', async ({ page }) => {
  const rand = Math.random().toString(36).slice(2, 8);
  const email = `instructor+${rand}@e2e.pgt`;
  const academyName = `E2E Academy ${rand}`;

  const criarPage = new CriarAcademiaPage(page);
  await criarPage.goto();
  await criarPage.fillAndSubmit({
    name: 'E2E Instructor',
    email,
    password: 'Test1234!',
    academyName,
    city: 'Lisboa',
  });

  // After submit, window.location.href = '/' — wait for navigation
  await expect(page).toHaveURL(/\/$|\/dashboard/, { timeout: 15_000 });

  // Find academy in DB and register for cleanup
  const rows = await e2eDb
    .select()
    .from(schema.academy)
    .where(eq(schema.academy.name, academyName));
  if (rows[0]) academy = rows[0];
});

// ─── Test 4 ──────────────────────────────────────────────────────────────────

test('invalid join code shows academia não encontrada', async ({ page }) => {
  const entrarPage = new EntrarPage(page);
  await entrarPage.goto('INVALID-CODE-XYZ');
  await expect(entrarPage.notFoundMessage()).toBeVisible({ timeout: 10_000 });
});

// ─── Test 5 ──────────────────────────────────────────────────────────────────

test('forgot password reaches confirmation', async ({ page }) => {
  const forgotPage = new ForgotPasswordPage(page);
  await forgotPage.goto();
  await forgotPage.requestReset('anyuser@e2e.pgt');
  await expect(forgotPage.successMessage()).toBeVisible({ timeout: 10_000 });
});

// ─── Test 6 ──────────────────────────────────────────────────────────────────

test('login with wrong password shows error', async ({ page }) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('doesnotexist@e2e.pgt', 'wrongpassword');

  // BetterAuth returns an error message — visible as p.text-destructive
  await expect(loginPage.errorMessage()).toBeVisible({ timeout: 10_000 });
});
