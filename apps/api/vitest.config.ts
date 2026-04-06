import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./test/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/pgt_test',
    },
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
