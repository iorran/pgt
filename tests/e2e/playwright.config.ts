import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const TEST_TARGET = process.env.TEST_TARGET ?? 'local';
const IS_CI = TEST_TARGET === 'ci';

const API_HEALTH_URL = 'http://localhost:3000/health';
const WEB_URL = 'http://localhost:5173';

const API_DEV_COMMAND =
  'DEV_AUTH_BYPASS=1 NODE_ENV=development npm run dev --workspace=@pgt/api';
const WEB_DEV_COMMAND = 'npm run dev --workspace=@pgt/web';

// CI runs the API via `tsx` (same as dev) instead of compiled `dist/index.js`.
// The api workspace is `"type": "module"` but tsconfig uses
// `moduleResolution: "bundler"`, which emits extensionless relative imports
// that Node's ESM loader rejects at runtime. tsx tolerates them transparently.
// Fixing the root cause (adding `.js` to every relative import in apps/api)
// is out of scope for this branch; this command keeps the CI path functional.
const API_BUILD_COMMAND =
  'DEV_AUTH_BYPASS=1 NODE_ENV=development npx tsx apps/api/src/index.ts';
const WEB_BUILD_COMMAND =
  'npm run build --workspace=@pgt/web && npm run preview --workspace=@pgt/web -- --port 5173 --strictPort';

export default defineConfig({
  testDir: path.join(__dirname, 'flows'),
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
      // Desktop project skips mobile-specific specs; they have their
      // own project that runs at a phone viewport.
      testIgnore: [
        '**/student-mobile.spec.ts',
        '**/pwa-installability.spec.ts',
      ],
    },
    {
      // Mobile viewport via Chromium (not WebKit) so no extra browser
      // install is needed. Scoped to the new mobile-first specs only —
      // the rest of the suite was written for desktop and doesn't need
      // to re-run on a phone viewport.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
      testMatch: [
        '**/student-mobile.spec.ts',
        '**/pwa-installability.spec.ts',
      ],
    },
  ],
  outputDir: path.join(REPO_ROOT, 'test-results'),
  fullyParallel: false,
  workers: IS_CI ? 1 : 2,
  retries: IS_CI ? 1 : 0,
  reporter: IS_CI
    ? [['github'], ['html', { outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'Europe/Lisbon',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: IS_CI ? API_BUILD_COMMAND : API_DEV_COMMAND,
      url: API_HEALTH_URL,
      reuseExistingServer: !IS_CI,
      timeout: 120_000,
      cwd: REPO_ROOT,
    },
    {
      command: IS_CI ? WEB_BUILD_COMMAND : WEB_DEV_COMMAND,
      url: WEB_URL,
      reuseExistingServer: !IS_CI,
      timeout: 120_000,
      cwd: REPO_ROOT,
    },
  ],
});
