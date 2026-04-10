import { test, expect } from '@playwright/test';

// vite-plugin-pwa only emits the manifest link and service worker in a
// production build. The dev server (TEST_TARGET=local, the default)
// doesn't serve them, so these assertions only make sense when the web
// app is running from `vite preview` after `vite build` — i.e., when
// TEST_TARGET=ci.
const IS_BUILT = process.env.TEST_TARGET === 'ci';

test.describe('PWA installability', () => {
  test.skip(!IS_BUILT, 'PWA assets are only present in build/preview mode');

  test('manifest is linked and contains required fields', async ({ page, request }) => {
    await page.goto('/');

    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const resolved = new URL(manifestHref!, page.url()).toString();
    const response = await request.get(resolved);
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();
    expect(manifest.name).toBe('Portugal Gold Team');
    expect(manifest.short_name).toBe('PGT');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.theme_color).toMatch(/^#/);

    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    const maskable = manifest.icons.find(
      (i: { purpose?: string }) => (i.purpose ?? '').includes('maskable'),
    );
    expect(maskable).toBeTruthy();
  });

  test('service worker registers', async ({ page }) => {
    await page.goto('/');
    // Give the SW a moment to register after page load.
    await page.waitForFunction(
      async () => {
        if (!('serviceWorker' in navigator)) return false;
        const reg = await navigator.serviceWorker.getRegistration();
        return Boolean(reg);
      },
      null,
      { timeout: 10_000 },
    );
  });
});
