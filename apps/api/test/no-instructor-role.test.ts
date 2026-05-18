import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

// Repo root = three levels up from apps/api/test/
const repoRoot = path.resolve(import.meta.dirname, '../../..');

describe('no instructor role literal survives', () => {
  it('apps/api/src + apps/web/src have no quoted instructor role literal', () => {
    // Allowed survivors: class.instructorId, schedule.ts `instructor?` name
    // field, the *Owner test factory. Match the word "instructor" only as a
    // quoted role-ish string literal.
    let out = '';
    try {
      out = execSync(
        `grep -rnE "['\\"]instructor['\\"]" apps/api/src apps/web/src`,
        { cwd: repoRoot, encoding: 'utf8' },
      );
    } catch (err: any) {
      // grep exit 1 = no matches (the passing case). Anything else is a real error.
      if (err.status !== 1) {
        throw err;
      }
    }
    expect(out.trim()).toBe('');
  });
});
