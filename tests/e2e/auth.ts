import type { Browser, BrowserContext } from '@playwright/test';

/**
 * Create a new browser context already authenticated as the given email.
 *
 * Uses /api/dev/impersonate (guarded by NODE_ENV=development +
 * DEV_AUTH_BYPASS=1) to skip the login form. The cookie is set via the
 * Vite dev proxy on the same origin as the web app so BetterAuth's
 * get-session endpoint recognises the session on the first request.
 *
 * The returned context includes locale pt-BR and Europe/Lisbon timezone
 * so rendered content matches the canonical language and time formatting.
 */
export async function impersonateAs(
  browser: Browser,
  email: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'Europe/Lisbon',
    baseURL: 'http://localhost:5173',
  });

  const page = await context.newPage();
  const response = await page.goto(
    `/api/dev/impersonate?email=${encodeURIComponent(email)}`,
  );
  if (!response || !response.ok()) {
    throw new Error(
      `impersonate failed for ${email}: HTTP ${response?.status()}. ` +
        `Ensure the API is running with DEV_AUTH_BYPASS=1 and NODE_ENV=development.`,
    );
  }
  await page.close();
  return context;
}
