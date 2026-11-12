import { afterAll } from 'vitest';

// Each test file loads its own copy of these pools; close them so the suite stays under Postgres' connection limit.
// Imported lazily so files that vi.mock modules (e.g. the email provider) still get their mocks.
afterAll(async () => {
  const [{ connection }, { testConnection }] = await Promise.all([import('../src/db/client.js'), import('./helpers.js')]);
  await Promise.all([connection.end(), testConnection.end()]);
});
