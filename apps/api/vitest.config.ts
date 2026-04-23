import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./test/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/pgt_test',
      // dev-impersonate signs its session cookie with this secret; set a
      // deterministic value so the endpoint doesn't 500 during tests.
      BETTER_AUTH_SECRET: 'test-secret-do-not-use-in-prod',
    },
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
