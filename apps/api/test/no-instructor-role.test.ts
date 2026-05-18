import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('no instructor role literal survives', () => {
  it('apps/api/src + apps/web/src have no role-instructor string', () => {
    // Allowed survivors: class.instructorId, schedule.ts `instructor?` name
    // field, the *Owner test factory. Match the standalone word
    // "instructor" only as a quoted role-ish string literal.
    const out = execSync(
      `grep -rnE "['\\"]instructor['\\"]" apps/api/src apps/web/src || true`,
      { cwd: '/Users/iorran/pgt', encoding: 'utf8' },
    ).trim();
    expect(out).toBe('');
  });
});
