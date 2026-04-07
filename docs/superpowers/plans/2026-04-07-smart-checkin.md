# Smart Checkin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unrestricted checkin with a validated system supporting proximity-based and QR code checkin methods.

**Architecture:** Server-side validation pipeline enforces time windows, duplicate prevention, overlap constraints, proximity checks, and QR token verification. Two new frontend pages (totem for instructors, QR landing for students). Existing classes page updated with smart checkin buttons.

**Tech Stack:** Fastify, Drizzle ORM, PostgreSQL, React 19, TanStack Query, Vitest, qrcode.react (QR generation), html5-qrcode (QR scanning)

---

## File Structure

**New files:**
- `apps/api/src/db/schema/checkin-token.ts` — QR token table schema
- `apps/api/src/utils/haversine.ts` — distance calculation utility
- `apps/api/src/utils/time-window.ts` — class active window check utility
- `apps/api/test/utils/haversine.test.ts` — haversine unit tests
- `apps/api/test/utils/time-window.test.ts` — time window unit tests
- `apps/api/test/checkins-validation.test.ts` — checkin validation pipeline tests
- `apps/api/test/checkin-tokens.test.ts` — token endpoint tests
- `apps/web/src/pages/totem.tsx` — instructor tablet page
- `apps/web/src/pages/checkin-scan.tsx` — QR scan landing page
- `apps/web/test/pages/totem.test.tsx` — totem page tests
- `apps/web/test/pages/checkin-scan.test.tsx` — scan landing page tests

**Modified files:**
- `apps/api/src/db/schema/academy.ts` — add latitude, longitude, address
- `apps/api/src/db/schema/checkin.ts` — add source, latitude, longitude, unique index
- `apps/api/src/db/schema/index.ts` — export new schema
- `apps/api/src/routes/checkins.ts` — full rework with validation + token endpoint
- `apps/api/src/routes/academies.ts` — accept location fields
- `apps/api/test/helpers.ts` — update cleanDb for new table
- `apps/web/src/pages/classes/index.tsx` — smart checkin buttons
- `apps/web/src/App.tsx` — add /totem and /checkin routes
- `apps/web/src/i18n/pt-BR.json` — new translation keys
- `apps/web/src/i18n/en.json` — new translation keys
- `apps/web/test/pages/classes.test.tsx` — update for new checkin behavior

---

### Task 1: Haversine Distance Utility

**Files:**
- Create: `apps/api/src/utils/haversine.ts`
- Create: `apps/api/test/utils/haversine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/utils/haversine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { haversineDistance } from '../../src/utils/haversine';

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });

  it('calculates short distance accurately', () => {
    // ~110m apart (same street in São Paulo)
    const distance = haversineDistance(-23.5505, -46.6333, -23.5515, -46.6333);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });

  it('returns distance in meters', () => {
    // São Paulo to Rio de Janeiro (~360km)
    const distance = haversineDistance(-23.55, -46.63, -22.91, -43.17);
    expect(distance).toBeGreaterThan(350_000);
    expect(distance).toBeLessThan(370_000);
  });

  it('handles negative and positive coordinates', () => {
    // London to New York
    const distance = haversineDistance(51.5074, -0.1278, 40.7128, -74.006);
    expect(distance).toBeGreaterThan(5_500_000);
    expect(distance).toBeLessThan(5_600_000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run test/utils/haversine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement haversine**

Create `apps/api/src/utils/haversine.ts`:

```typescript
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run test/utils/haversine.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/haversine.ts apps/api/test/utils/haversine.test.ts
git commit -m "feat: add haversine distance calculation utility"
```

---

### Task 2: Time Window Utility

**Files:**
- Create: `apps/api/src/utils/time-window.ts`
- Create: `apps/api/test/utils/time-window.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/utils/time-window.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isClassActiveNow } from '../../src/utils/time-window';

describe('isClassActiveNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true during class time', () => {
    // Monday 07:30 — class is Mon 07:00-08:30
    vi.setSystemTime(new Date('2026-04-06T07:30:00')); // Monday
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(true);
  });

  it('returns true 15 minutes before start', () => {
    vi.setSystemTime(new Date('2026-04-06T06:45:00')); // Monday
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(true);
  });

  it('returns true 1 hour after end', () => {
    vi.setSystemTime(new Date('2026-04-06T09:29:00')); // Monday
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(true);
  });

  it('returns false 16 minutes before start', () => {
    vi.setSystemTime(new Date('2026-04-06T06:44:00')); // Monday
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(false);
  });

  it('returns false more than 1 hour after end', () => {
    vi.setSystemTime(new Date('2026-04-06T09:31:00')); // Monday
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1,
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(false);
  });

  it('returns false on wrong day of week', () => {
    vi.setSystemTime(new Date('2026-04-07T07:30:00')); // Tuesday
    expect(isClassActiveNow({
      recurrence: 'weekly',
      dayOfWeek: 1, // Monday
      date: null,
      startTime: '07:00',
      endTime: '08:30',
    })).toBe(false);
  });

  it('handles one-time class by date', () => {
    vi.setSystemTime(new Date('2026-04-10T10:00:00')); // Friday
    expect(isClassActiveNow({
      recurrence: 'once',
      dayOfWeek: null,
      date: '2026-04-10',
      startTime: '09:30',
      endTime: '11:00',
    })).toBe(true);
  });

  it('returns false for one-time class on wrong date', () => {
    vi.setSystemTime(new Date('2026-04-11T10:00:00')); // Saturday
    expect(isClassActiveNow({
      recurrence: 'once',
      dayOfWeek: null,
      date: '2026-04-10',
      startTime: '09:30',
      endTime: '11:00',
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run test/utils/time-window.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement time window check**

Create `apps/api/src/utils/time-window.ts`:

```typescript
interface ClassSchedule {
  recurrence: string;
  dayOfWeek: number | null;
  date: string | null;
  startTime: string;
  endTime: string;
}

const BUFFER_BEFORE_MIN = 15;
const BUFFER_AFTER_MIN = 60;

export function isClassActiveNow(cls: ClassSchedule, now: Date = new Date()): boolean {
  // Check day match
  if (cls.recurrence === 'weekly') {
    if (cls.dayOfWeek !== now.getDay()) return false;
  } else {
    // one-time class: compare date string
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (cls.date !== todayStr) return false;
  }

  // Parse times and compare with buffers
  const [startH, startM] = cls.startTime.split(':').map(Number);
  const [endH, endM] = cls.endTime.split(':').map(Number);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const windowStart = startMinutes - BUFFER_BEFORE_MIN;
  const windowEnd = endMinutes + BUFFER_AFTER_MIN;

  return nowMinutes >= windowStart && nowMinutes <= windowEnd;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run test/utils/time-window.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/time-window.ts apps/api/test/utils/time-window.test.ts
git commit -m "feat: add time window check utility for class checkin"
```

---

### Task 3: Database Schema Changes

**Files:**
- Modify: `apps/api/src/db/schema/academy.ts`
- Modify: `apps/api/src/db/schema/checkin.ts`
- Create: `apps/api/src/db/schema/checkin-token.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Modify: `apps/api/test/helpers.ts`

- [ ] **Step 1: Update academy schema**

Edit `apps/api/src/db/schema/academy.ts` — add latitude, longitude, address columns:

```typescript
import { pgTable, uuid, varchar, timestamp, decimal } from 'drizzle-orm/pg-core';

export const academy = pgTable('academy', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  joinCode: varchar('join_code', { length: 50 }).unique(),
  city: varchar('city', { length: 255 }),
  address: varchar('address', { length: 500 }),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  ownerId: uuid('owner_id'),
  logoUrl: varchar('logo_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

- [ ] **Step 2: Update checkin schema**

Edit `apps/api/src/db/schema/checkin.ts` — add source, latitude, longitude, unique index:

```typescript
import { pgTable, uuid, timestamp, index, uniqueIndex, pgEnum, decimal } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bjjClass } from './class';
import { user } from './user';

export const checkinSourceEnum = pgEnum('checkin_source', ['button', 'qr']);

export const checkin = pgTable('checkin', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => bjjClass.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  source: checkinSourceEnum('source').notNull().default('button'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  checkedInAt: timestamp('checked_in_at').defaultNow().notNull(),
}, (table) => [
  index('checkin_student_date_idx').on(table.studentId, table.checkedInAt),
  index('checkin_class_idx').on(table.classId),
  uniqueIndex('checkin_class_student_day_idx').on(table.classId, table.studentId, sql`DATE(${table.checkedInAt})`),
]);
```

- [ ] **Step 3: Create checkin token schema**

Create `apps/api/src/db/schema/checkin-token.ts`:

```typescript
import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { bjjClass } from './class';

export const checkinToken = pgTable('checkin_token', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => bjjClass.id),
  token: varchar('token', { length: 100 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('checkin_token_token_idx').on(table.token),
]);
```

- [ ] **Step 4: Export new schema from index**

Edit `apps/api/src/db/schema/index.ts` — add the new export:

```typescript
export * from './academy';
export * from './user';
export * from './auth';
export * from './class';
export * from './checkin';
export * from './checkin-token';
export * from './membership';
export * from './payment';
export * from './product';
export * from './order';
export * from './season';
export * from './competition-result';
export * from './tournament';
export * from './gamification';
```

- [ ] **Step 5: Update test helpers — add checkin_token to cleanDb**

Edit `apps/api/test/helpers.ts` — add `checkin_token` to the TRUNCATE statement (before `checkin`):

```sql
TRUNCATE TABLE
  xp_entry, student_badge, badge_definition, streak,
  tournament_signup, tournament,
  competition_result, season,
  "order", product,
  payment, student_membership, membership_plan,
  checkin_token, checkin, class,
  session, account, verification,
  "user", academy
CASCADE
```

- [ ] **Step 6: Generate and run migration**

```bash
cd apps/api && npx drizzle-kit generate && npx drizzle-kit migrate
```

Note: The unique index uses `DATE(checked_in_at)` — verify the generated SQL includes this expression-based index. If Drizzle doesn't support it directly, add a raw SQL migration manually.

- [ ] **Step 7: Run existing tests to confirm nothing is broken**

Run: `cd apps/api && npx vitest run`
Expected: All existing tests PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/db/schema/ apps/api/test/helpers.ts apps/api/drizzle/
git commit -m "feat: add schema for checkin tokens, location, and source tracking"
```

---

### Task 4: Checkin Validation Pipeline (API)

**Files:**
- Modify: `apps/api/src/routes/checkins.ts`
- Create: `apps/api/test/checkins-validation.test.ts`

- [ ] **Step 1: Write failing tests for the validation pipeline**

Create `apps/api/test/checkins-validation.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll, vi, afterEach } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestInstructor,
  authHeaders,
  testDb,
} from './helpers';
import { bjjClass, checkin } from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

afterEach(() => {
  vi.useRealTimers();
});

async function setupClassToday(overrides: Record<string, any> = {}) {
  const now = new Date();
  const acad = await createTestAcademy({
    latitude: '-23.5505',
    longitude: '-46.6333',
    address: 'Rua Test, 123',
  });
  const instructor = await createTestInstructor(acad.id);
  const student = await createTestUser(acad.id, { role: 'student' });
  const [cls] = await testDb.insert(bjjClass).values({
    academyId: acad.id,
    instructorId: instructor.id,
    name: 'Gi Class',
    type: 'gi',
    recurrence: 'weekly',
    dayOfWeek: now.getDay(),
    startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
    endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
    ...overrides,
  }).returning();
  return { acad, instructor, student, cls };
}

describe('POST /api/checkins — validation', () => {
  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      payload: { classId: 'any', source: 'button', latitude: -23.55, longitude: -46.63 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects checkin for inactive class', async () => {
    const { student, cls } = await setupClassToday();
    await testDb.update(bjjClass).set({ active: false }).where(eq(bjjClass.id, cls.id));

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('CLASS_NOT_ACTIVE');
  });

  it('rejects checkin outside time window', async () => {
    // Class is today but at a time that's not now
    const { student } = await setupClassToday();
    const acad = await createTestAcademy({
      latitude: '-23.5505',
      longitude: '-46.6333',
    });
    const instructor = await createTestInstructor(acad.id);
    // Create class at 03:00-04:00 (definitely not now unless running tests at 3am)
    const [cls] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Late Night',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: new Date().getDay(),
      startTime: '03:00',
      endTime: '04:00',
    }).returning();
    const student2 = await createTestUser(acad.id, { role: 'student' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student2),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('OUTSIDE_TIME_WINDOW');
  });

  it('rejects duplicate checkin same class same day', async () => {
    const { student, cls } = await setupClassToday();

    // First checkin
    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });

    // Second checkin
    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('CHECKIN_DUPLICATE');
  });

  it('rejects checkin when student is too far', async () => {
    const { student, cls } = await setupClassToday();

    // Coordinates ~5km away from academy
    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.59, longitude: -46.68 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('TOO_FAR');
  });

  it('rejects checkin when academy has no location set', async () => {
    const acad = await createTestAcademy(); // no lat/lng
    const instructor = await createTestInstructor(acad.id);
    const student = await createTestUser(acad.id, { role: 'student' });
    const now = new Date();
    const [cls] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Gi Class',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: now.getDay(),
      startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
      endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.55, longitude: -46.63 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('LOCATION_NOT_SET');
  });

  it('allows checkin to different class same day', async () => {
    const { acad, instructor, student, cls } = await setupClassToday();
    const now = new Date();
    const [cls2] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'No-Gi',
      type: 'no-gi',
      recurrence: 'weekly',
      dayOfWeek: now.getDay(),
      startTime: `${String(now.getHours() + 2).padStart(2, '0')}:00`,
      endTime: `${String(now.getHours() + 3).padStart(2, '0')}:30`,
    }).returning();

    // Checkin to first class
    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });

    // Mock time to be during second class window
    vi.setSystemTime(new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 2, 30));

    // Checkin to second class (different start time)
    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls2.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });
    expect(res.statusCode).toBe(201);
  });

  it('rejects checkin to overlapping class (same start time)', async () => {
    const { acad, instructor, student, cls } = await setupClassToday();
    const now = new Date();
    const [cls2] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'No-Gi',
      type: 'no-gi',
      recurrence: 'weekly',
      dayOfWeek: now.getDay(),
      startTime: cls.startTime, // same start time
      endTime: cls.endTime,
    }).returning();

    // Checkin to first class
    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });

    // Try to checkin to second class with same start time
    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls2.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('OVERLAPPING_CLASS');
  });

  it('creates checkin with source and coordinates on success', async () => {
    const { student, cls } = await setupClassToday();

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.source).toBe('button');
    expect(body.studentId).toBe(student.id);
  });

  it('still updates streak on successful checkin', async () => {
    const { student, cls } = await setupClassToday();

    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });

    const { streak } = await import('../src/db/schema/index');
    const { eq } = await import('drizzle-orm');
    const streaks = await testDb.select().from(streak).where(eq(streak.studentId, student.id));
    expect(streaks).toHaveLength(1);
    expect(streaks[0].currentStreak).toBe(1);
  });
});
```

Note: Add `import { eq } from 'drizzle-orm';` at the top of the file alongside other imports.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run test/checkins-validation.test.ts`
Expected: FAIL — validation not implemented yet

- [ ] **Step 3: Rewrite checkins route with validation pipeline**

Replace `apps/api/src/routes/checkins.ts` with:

```typescript
import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { checkin, streak, bjjClass, academy } from '../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { haversineDistance } from '../utils/haversine.js';
import { isClassActiveNow } from '../utils/time-window.js';

const MAX_DISTANCE_METERS = 250;

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function updateStreak(studentId: string) {
  const now = new Date();
  const currentWeek = getISOWeek(now);
  const existing = await db.select().from(streak).where(eq(streak.studentId, studentId)).limit(1);

  if (existing.length === 0) {
    await db.insert(streak).values({
      studentId,
      currentStreak: 1,
      longestStreak: 1,
      lastCheckinWeek: currentWeek,
    });
  } else {
    const s = existing[0];
    if (s.lastCheckinWeek !== currentWeek) {
      const lastWeekDate = new Date(now);
      lastWeekDate.setDate(lastWeekDate.getDate() - 7);
      const lastWeek = getISOWeek(lastWeekDate);
      const newStreak = s.lastCheckinWeek === lastWeek ? s.currentStreak + 1 : 1;
      const newLongest = Math.max(s.longestStreak, newStreak);
      await db.update(streak)
        .set({ currentStreak: newStreak, longestStreak: newLongest, lastCheckinWeek: currentWeek, updatedAt: now })
        .where(eq(streak.studentId, studentId));
    }
  }
}

export async function checkinRoutes(app: FastifyInstance) {
  // Check in to a class
  app.post('/api/checkins', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as {
      classId: string;
      source: 'button' | 'qr';
      latitude?: number;
      longitude?: number;
      token?: string;
    };
    const studentId = request.user.id;
    const { classId, source } = body;

    // 1. Class exists and is active
    const [cls] = await db.select().from(bjjClass).where(eq(bjjClass.id, classId));
    if (!cls || !cls.active) {
      return reply.status(400).send({ error: 'CLASS_NOT_ACTIVE' });
    }

    // 2. Time window check
    if (!isClassActiveNow(cls)) {
      return reply.status(400).send({ error: 'OUTSIDE_TIME_WINDOW' });
    }

    // 3. Duplicate check — same student, same class, same day
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const [existing] = await db.select().from(checkin).where(
      and(
        eq(checkin.classId, classId),
        eq(checkin.studentId, studentId),
        sql`${checkin.checkedInAt} >= ${startOfDay}`,
        sql`${checkin.checkedInAt} < ${endOfDay}`,
      ),
    );
    if (existing) {
      return reply.status(400).send({ error: 'CHECKIN_DUPLICATE' });
    }

    // 4. Overlap check — same student, same day, same start time
    const [overlap] = await db
      .select()
      .from(checkin)
      .innerJoin(bjjClass, eq(bjjClass.id, checkin.classId))
      .where(
        and(
          eq(checkin.studentId, studentId),
          sql`${checkin.checkedInAt} >= ${startOfDay}`,
          sql`${checkin.checkedInAt} < ${endOfDay}`,
          eq(bjjClass.startTime, cls.startTime),
        ),
      );
    if (overlap) {
      return reply.status(400).send({ error: 'OVERLAPPING_CLASS' });
    }

    // 5. Source-specific validation
    if (source === 'qr') {
      // QR token validation — implemented in Task 5
      const { checkinToken } = await import('../db/schema/index.js');
      const [tokenRecord] = await db.select().from(checkinToken).where(
        and(
          eq(checkinToken.token, body.token || ''),
          eq(checkinToken.classId, classId),
          sql`${checkinToken.expiresAt} > NOW()`,
        ),
      );
      if (!tokenRecord) {
        return reply.status(400).send({ error: 'INVALID_TOKEN' });
      }
    } else {
      // Proximity validation
      const [acad] = await db.select().from(academy).where(eq(academy.id, cls.academyId));
      if (!acad.latitude || !acad.longitude) {
        return reply.status(400).send({ error: 'LOCATION_NOT_SET' });
      }
      const distance = haversineDistance(
        Number(acad.latitude),
        Number(acad.longitude),
        body.latitude!,
        body.longitude!,
      );
      if (distance > MAX_DISTANCE_METERS) {
        return reply.status(400).send({ error: 'TOO_FAR' });
      }
    }

    // Create checkin
    const [created] = await db.insert(checkin).values({
      classId,
      studentId,
      source,
      latitude: source === 'button' ? String(body.latitude) : null,
      longitude: source === 'button' ? String(body.longitude) : null,
    }).returning();

    await updateStreak(studentId);

    return reply.status(201).send(created);
  });

  // Get attendance for a class
  app.get('/api/checkins/class/:classId', async (request) => {
    const { classId } = request.params as { classId: string };
    return db.select().from(checkin).where(eq(checkin.classId, classId)).orderBy(desc(checkin.checkedInAt));
  });

  // Get attendance history for a student
  app.get('/api/checkins/student/:studentId', async (request) => {
    const { studentId } = request.params as { studentId: string };
    return db.select().from(checkin).where(eq(checkin.studentId, studentId)).orderBy(desc(checkin.checkedInAt));
  });
}
```

- [ ] **Step 4: Run validation tests to verify they pass**

Run: `cd apps/api && npx vitest run test/checkins-validation.test.ts`
Expected: PASS (all validation tests)

- [ ] **Step 5: Update existing checkins.test.ts**

The existing tests in `apps/api/test/checkins.test.ts` need updating because `POST /api/checkins` now requires auth and different payload. Replace the test file:

```typescript
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestInstructor,
  authHeaders,
  testDb,
} from './helpers';
import { bjjClass, checkin, streak } from '../src/db/schema/index';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

async function createClassAndStudent() {
  const now = new Date();
  const acad = await createTestAcademy({
    latitude: '-23.5505',
    longitude: '-46.6333',
  });
  const instructor = await createTestInstructor(acad.id);
  const student = await createTestUser(acad.id, { role: 'student' });
  const [cls] = await testDb.insert(bjjClass).values({
    academyId: acad.id,
    instructorId: instructor.id,
    name: 'Gi Class',
    type: 'gi',
    recurrence: 'weekly',
    dayOfWeek: now.getDay(),
    startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
    endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
  }).returning();
  return { acad, instructor, student, cls };
}

describe('POST /api/checkins', () => {
  it('creates a checkin and returns 201', async () => {
    const { student, cls } = await createClassAndStudent();

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.studentId).toBe(student.id);
    expect(body.classId).toBe(cls.id);
    expect(body.checkedInAt).toBeDefined();
  });

  it('creates a streak record on first checkin', async () => {
    const { student, cls } = await createClassAndStudent();

    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'button', latitude: -23.5505, longitude: -46.6333 },
    });

    const streaks = await testDb.select().from(streak).where(eq(streak.studentId, student.id));
    expect(streaks).toHaveLength(1);
    expect(streaks[0].currentStreak).toBe(1);
    expect(streaks[0].longestStreak).toBe(1);
  });
});

describe('GET /api/checkins/class/:classId', () => {
  it('returns checkins for a class', async () => {
    const { student, cls } = await createClassAndStudent();
    await testDb.insert(checkin).values({ classId: cls.id, studentId: student.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/class/${cls.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('returns empty array when no checkins exist', async () => {
    const { cls } = await createClassAndStudent();

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/class/${cls.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('GET /api/checkins/student/:studentId', () => {
  it('returns checkin history for a student', async () => {
    const { student, cls } = await createClassAndStudent();
    await testDb.insert(checkin).values({ classId: cls.id, studentId: student.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${student.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('returns empty array for student with no checkins', async () => {
    const { student } = await createClassAndStudent();

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${student.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Run all checkin tests**

Run: `cd apps/api && npx vitest run test/checkins.test.ts test/checkins-validation.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/checkins.ts apps/api/test/checkins.test.ts apps/api/test/checkins-validation.test.ts
git commit -m "feat: add checkin validation pipeline with time, duplicate, proximity checks"
```

---

### Task 5: QR Token Endpoint

**Files:**
- Modify: `apps/api/src/routes/checkins.ts`
- Create: `apps/api/test/checkin-tokens.test.ts`

- [ ] **Step 1: Write failing tests for token endpoint**

Create `apps/api/test/checkin-tokens.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll, vi, afterEach } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestInstructor,
  authHeaders,
  testDb,
} from './helpers';
import { bjjClass, checkinToken } from '../src/db/schema/index';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/checkins/tokens', () => {
  it('requires instructor role', async () => {
    const acad = await createTestAcademy();
    const student = await createTestUser(acad.id, { role: 'student' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(student),
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns tokens for active classes', async () => {
    const now = new Date();
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);
    await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Active Class',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: now.getDay(),
      startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
      endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(instructor),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].className).toBe('Active Class');
    expect(body[0].token).toBeDefined();
    expect(body[0].expiresAt).toBeDefined();
  });

  it('returns empty array when no active classes', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);
    // Class on a different day
    await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Other Day',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: (new Date().getDay() + 3) % 7,
      startTime: '07:00',
      endTime: '08:30',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(instructor),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('reuses valid token if not expired', async () => {
    const now = new Date();
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);
    const [cls] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Gi Class',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: now.getDay(),
      startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
      endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
    }).returning();

    // First call creates token
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(instructor),
    });
    const token1 = res1.json()[0].token;

    // Second call reuses same token
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(instructor),
    });
    const token2 = res2.json()[0].token;

    expect(token1).toBe(token2);
  });
});

describe('POST /api/checkins — QR source', () => {
  it('accepts valid QR token', async () => {
    const now = new Date();
    const acad = await createTestAcademy({
      latitude: '-23.5505',
      longitude: '-46.6333',
    });
    const instructor = await createTestInstructor(acad.id);
    const student = await createTestUser(acad.id, { role: 'student' });
    const [cls] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Gi Class',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: now.getDay(),
      startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
      endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
    }).returning();

    // Get token
    const tokenRes = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(instructor),
    });
    const { token } = tokenRes.json()[0];

    // Checkin with QR
    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'qr', token },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().source).toBe('qr');
  });

  it('rejects expired QR token', async () => {
    const now = new Date();
    const acad = await createTestAcademy({
      latitude: '-23.5505',
      longitude: '-46.6333',
    });
    const instructor = await createTestInstructor(acad.id);
    const student = await createTestUser(acad.id, { role: 'student' });
    const [cls] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Gi Class',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: now.getDay(),
      startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
      endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
    }).returning();

    // Insert already-expired token
    await testDb.insert(checkinToken).values({
      classId: cls.id,
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 60_000), // 1 min ago
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: { classId: cls.id, source: 'qr', token: 'expired-token' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_TOKEN');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run test/checkin-tokens.test.ts`
Expected: FAIL — token endpoint not implemented

- [ ] **Step 3: Add token endpoint to checkins route**

Add to `apps/api/src/routes/checkins.ts`, inside `checkinRoutes` function, before the closing brace:

```typescript
  // Get active class tokens (instructor only — for totem page)
  app.get('/api/checkins/tokens', { preHandler: [requireInstructor, injectAcademyId] }, async (request) => {
    const academyId = request.academyId;

    // Get all active classes for this academy
    const classes = await db.select().from(bjjClass).where(
      and(eq(bjjClass.academyId, academyId), eq(bjjClass.active, true)),
    );

    // Filter to currently active classes
    const activeClasses = classes.filter((cls) => isClassActiveNow(cls));

    // Get or create tokens
    const results = [];
    for (const cls of activeClasses) {
      // Check for existing valid token
      const [existingToken] = await db.select().from(checkinToken).where(
        and(
          eq(checkinToken.classId, cls.id),
          sql`${checkinToken.expiresAt} > NOW()`,
        ),
      );

      if (existingToken) {
        results.push({
          classId: cls.id,
          className: cls.name,
          classType: cls.type,
          startTime: cls.startTime,
          endTime: cls.endTime,
          token: existingToken.token,
          expiresAt: existingToken.expiresAt,
        });
      } else {
        // Create new token
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await db.insert(checkinToken).values({ classId: cls.id, token, expiresAt });
        results.push({
          classId: cls.id,
          className: cls.name,
          classType: cls.type,
          startTime: cls.startTime,
          endTime: cls.endTime,
          token,
          expiresAt,
        });
      }
    }

    return results;
  });
```

Also add these imports to the top of `checkins.ts`:

```typescript
import { requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { checkinToken } from '../db/schema/index.js';
```

And remove the dynamic import of `checkinToken` from inside the POST handler (step 5 of validation), replacing with the static import above.

- [ ] **Step 4: Run token tests**

Run: `cd apps/api && npx vitest run test/checkin-tokens.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run all API tests to confirm nothing is broken**

Run: `cd apps/api && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/checkins.ts apps/api/test/checkin-tokens.test.ts
git commit -m "feat: add QR token generation and validation for checkin"
```

---

### Task 6: Academy Location Endpoint

**Files:**
- Modify: `apps/api/src/routes/academies.ts`
- Modify: `apps/api/test/academies.test.ts`

- [ ] **Step 1: Read current academies test file**

Read `apps/api/test/academies.test.ts` to understand existing test patterns.

- [ ] **Step 2: Write failing test for location update**

Add to `apps/api/test/academies.test.ts` a new describe block:

```typescript
describe('PUT /api/academies/:id/location', () => {
  it('requires instructor role', async () => {
    const acad = await createTestAcademy();
    const student = await createTestUser(acad.id, { role: 'student' });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/academies/${acad.id}/location`,
      headers: authHeaders(student),
      payload: { latitude: -23.55, longitude: -46.63, address: 'Rua Test' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('updates academy location', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/academies/${acad.id}/location`,
      headers: authHeaders(instructor),
      payload: { latitude: -23.5505, longitude: -46.6333, address: 'Rua Augusta, 123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.latitude).toBe('-23.5505000');
    expect(body.longitude).toBe('-46.6333000');
    expect(body.address).toBe('Rua Augusta, 123');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx vitest run test/academies.test.ts`
Expected: New tests FAIL

- [ ] **Step 4: Add location endpoint to academies route**

Add to `apps/api/src/routes/academies.ts`, inside `academyRoutes` function:

```typescript
  // Update academy location (instructor only)
  app.put('/api/academies/:id/location', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { latitude, longitude, address } = request.body as {
      latitude: number;
      longitude: number;
      address?: string;
    };

    const [updated] = await db.update(academy)
      .set({
        latitude: String(latitude),
        longitude: String(longitude),
        ...(address !== undefined && { address }),
      })
      .where(and(eq(academy.id, id), eq(academy.id, request.academyId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Academy not found' });
    return updated;
  });
```

Add `injectAcademyId` import if not already present:
```typescript
import { injectAcademyId } from '../middleware/tenant.js';
```

- [ ] **Step 5: Run academies tests**

Run: `cd apps/api && npx vitest run test/academies.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/academies.ts apps/api/test/academies.test.ts
git commit -m "feat: add academy location update endpoint"
```

---

### Task 7: Translation Keys

**Files:**
- Modify: `apps/web/src/i18n/pt-BR.json`
- Modify: `apps/web/src/i18n/en.json`

- [ ] **Step 1: Add Portuguese translations**

Add to the `classes` section in `apps/web/src/i18n/pt-BR.json`:

```json
"checkinProximity": "Check-in",
"checkinQR": "QR Code",
"checkedIn": "Presente",
"checkinTooFar": "Você está longe da academia",
"checkinDuplicate": "Você já fez check-in nesta aula hoje",
"checkinOverlap": "Você já fez check-in em outra aula neste horário",
"checkinOutsideWindow": "Esta aula não está acontecendo agora",
"checkinLocationNotSet": "A academia ainda não configurou a localização",
"checkinInvalidToken": "QR Code inválido ou expirado",
"scanQR": "Escanear QR Code",
"scanning": "Escaneando..."
```

Add a new `totem` section:

```json
"totem": {
  "title": "Totem de Check-in",
  "noClasses": "Nenhuma aula no momento",
  "nextClass": "Próxima aula",
  "scanToCheckin": "Escaneie para fazer check-in"
}
```

Add to the `academy` or `onboarding` section:

```json
"setLocation": "Definir localização da academia",
"useMyLocation": "Usar minha localização atual",
"locationSet": "Localização salva",
"address": "Endereço"
```

- [ ] **Step 2: Add English translations**

Add the same keys to `apps/web/src/i18n/en.json`:

Classes section:
```json
"checkinProximity": "Check-in",
"checkinQR": "QR Code",
"checkedIn": "Checked in",
"checkinTooFar": "You are too far from the academy",
"checkinDuplicate": "You already checked in to this class today",
"checkinOverlap": "You already checked in to another class at this time",
"checkinOutsideWindow": "This class is not happening right now",
"checkinLocationNotSet": "The academy has not set its location yet",
"checkinInvalidToken": "Invalid or expired QR Code",
"scanQR": "Scan QR Code",
"scanning": "Scanning..."
```

Totem section:
```json
"totem": {
  "title": "Check-in Totem",
  "noClasses": "No classes right now",
  "nextClass": "Next class",
  "scanToCheckin": "Scan to check in"
}
```

Location keys:
```json
"setLocation": "Set academy location",
"useMyLocation": "Use my current location",
"locationSet": "Location saved",
"address": "Address"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/pt-BR.json apps/web/src/i18n/en.json
git commit -m "feat: add translation keys for smart checkin system"
```

---

### Task 8: Install QR Libraries

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install QR code generation and scanning libraries**

```bash
cd apps/web && npm install qrcode.react html5-qrcode
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore: add qrcode.react and html5-qrcode dependencies"
```

---

### Task 9: Totem Page (Instructor Tablet)

**Files:**
- Create: `apps/web/src/pages/totem.tsx`
- Create: `apps/web/test/pages/totem.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/pages/totem.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import TotemPage from '@/pages/totem';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code">{value}</div>,
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const instructorSession = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('TotemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
  });

  it('shows active classes with QR codes', async () => {
    mockApi.mockResolvedValue([
      { classId: 'c1', className: 'Morning Gi', classType: 'gi', startTime: '07:00', endTime: '08:30', token: 'token-1', expiresAt: '2026-04-07T07:35:00Z' },
    ] as any);

    renderWithProviders(<TotemPage />);
    expect(await screen.findByText('Morning Gi')).toBeInTheDocument();
    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
  });

  it('shows no classes message when empty', async () => {
    mockApi.mockResolvedValue([] as any);

    renderWithProviders(<TotemPage />);
    expect(await screen.findByText('totem.noClasses')).toBeInTheDocument();
  });

  it('shows multiple active classes', async () => {
    mockApi.mockResolvedValue([
      { classId: 'c1', className: 'Morning Gi', classType: 'gi', startTime: '07:00', endTime: '08:30', token: 'token-1', expiresAt: '2026-04-07T07:35:00Z' },
      { classId: 'c2', className: 'Kids BJJ', classType: 'kids', startTime: '07:00', endTime: '08:00', token: 'token-2', expiresAt: '2026-04-07T07:35:00Z' },
    ] as any);

    renderWithProviders(<TotemPage />);
    expect(await screen.findByText('Morning Gi')).toBeInTheDocument();
    expect(screen.getByText('Kids BJJ')).toBeInTheDocument();
    expect(screen.getAllByTestId('qr-code')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/pages/totem.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement totem page**

Create `apps/web/src/pages/totem.tsx`:

```typescript
import { useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TokenData {
  classId: string;
  className: string;
  classType: string;
  startTime: string;
  endTime: string;
  token: string;
  expiresAt: string;
}

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export default function TotemPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;

  const { data: tokens = [], refetch } = useApiQuery<TokenData[]>(
    ['checkin-tokens'],
    '/checkins/tokens',
    !!user?.academyId,
  );

  // Poll every 4 minutes to refresh tokens
  useEffect(() => {
    const interval = setInterval(() => refetch(), 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col items-center">
      <h1 className="font-display text-4xl text-primary mb-8 arena-glow">PGT</h1>

      {tokens.length === 0 ? (
        <div className="text-center mt-20">
          <p className="text-2xl text-muted-foreground">{t('totem.noClasses')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {tokens.map((tk) => (
            <Card key={tk.classId} className="text-center">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="font-heading text-2xl uppercase">{tk.className}</h2>
                  <Badge variant="outline">{tk.classType}</Badge>
                </div>
                <p className="font-mono text-lg text-muted-foreground">
                  {tk.startTime} - {tk.endTime}
                </p>
                <div className="flex justify-center">
                  <QRCodeSVG
                    value={`${APP_URL}/checkin?token=${tk.token}&classId=${tk.classId}`}
                    size={250}
                    level="M"
                  />
                </div>
                <p className="text-sm text-muted-foreground">{t('totem.scanToCheckin')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/pages/totem.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/totem.tsx apps/web/test/pages/totem.test.tsx
git commit -m "feat: add totem page for instructor QR code display"
```

---

### Task 10: QR Scan Landing Page

**Files:**
- Create: `apps/web/src/pages/checkin-scan.tsx`
- Create: `apps/web/test/pages/checkin-scan.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/pages/checkin-scan.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRoute } from '../render';
import CheckinScanPage from '@/pages/checkin-scan';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const studentSession = {
  data: { user: { id: 'u1', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('CheckinScanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(studentSession);
  });

  it('calls checkin API with token from URL', async () => {
    mockApi.mockResolvedValue({ success: true } as any);

    renderWithRoute(<CheckinScanPage />, ['/checkin?token=abc123&classId=c1']);

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/checkins', {
        method: 'POST',
        body: JSON.stringify({ classId: 'c1', source: 'qr', token: 'abc123' }),
      });
    });
  });

  it('shows success message after checkin', async () => {
    mockApi.mockResolvedValue({ success: true } as any);

    renderWithRoute(<CheckinScanPage />, ['/checkin?token=abc123&classId=c1']);

    expect(await screen.findByText('classes.checkinSuccess')).toBeInTheDocument();
  });

  it('shows error message on failure', async () => {
    mockApi.mockRejectedValue(new Error('CHECKIN_DUPLICATE'));

    renderWithRoute(<CheckinScanPage />, ['/checkin?token=abc123&classId=c1']);

    expect(await screen.findByText('CHECKIN_DUPLICATE')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/pages/checkin-scan.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement checkin scan page**

Create `apps/web/src/pages/checkin-scan.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CheckinScanPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const token = searchParams.get('token');
  const classId = searchParams.get('classId');

  useEffect(() => {
    if (!session || !token || !classId) return;

    api('/checkins', {
      method: 'POST',
      body: JSON.stringify({ classId, source: 'qr', token }),
    })
      .then(() => setStatus('success'))
      .catch((err: Error) => {
        setStatus('error');
        setErrorMsg(err.message);
      });
  }, [session, token, classId]);

  if (!session) {
    return null; // App.tsx will redirect to login
  }

  return (
    <div className="min-h-screen flex items-center justify-center arena-stripes px-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8 text-center space-y-6">
          <h1 className="font-display text-4xl text-primary leading-none arena-glow">PGT</h1>

          {status === 'loading' && (
            <p className="text-muted-foreground">{t('common.loading')}</p>
          )}

          {status === 'success' && (
            <>
              <p className="text-xl text-primary font-heading uppercase">{t('classes.checkinSuccess')}</p>
              <Button onClick={() => navigate('/')}>{t('common.back')}</Button>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="text-destructive">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate('/')}>{t('common.back')}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/pages/checkin-scan.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/checkin-scan.tsx apps/web/test/pages/checkin-scan.test.tsx
git commit -m "feat: add QR scan landing page for student checkin"
```

---

### Task 11: Update Classes Page with Smart Checkin

**Files:**
- Modify: `apps/web/src/pages/classes/index.tsx`
- Modify: `apps/web/test/pages/classes.test.tsx`

- [ ] **Step 1: Update classes test for new checkin behavior**

Update `apps/web/test/pages/classes.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import ClassesPage from '@/pages/classes/index';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const instructorSession = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const studentSession = {
  data: { user: { id: 'u2', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const now = new Date();
const mockClasses = [
  {
    id: 'c1',
    name: 'Morning Gi',
    type: 'gi',
    dayOfWeek: now.getDay(),
    startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
    endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
    instructor: 'Prof Silva',
  },
  {
    id: 'c2',
    name: 'No-Gi Night',
    type: 'no-gi',
    dayOfWeek: (now.getDay() + 3) % 7,
    startTime: '19:00',
    endTime: '20:30',
  },
];

describe('ClassesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue(mockClasses as any);
  });

  it('renders page title', async () => {
    renderWithProviders(<ClassesPage />);
    await waitFor(() => {
      expect(screen.getByText('classes.title')).toBeInTheDocument();
    });
  });

  it('shows class cards after API fetch', async () => {
    renderWithProviders(<ClassesPage />);
    expect(await screen.findByText('Morning Gi')).toBeInTheDocument();
    expect(screen.getByText('No-Gi Night')).toBeInTheDocument();
  });

  it('shows create button for instructors', async () => {
    renderWithProviders(<ClassesPage />);
    await waitFor(() => {
      expect(screen.getByText('classes.createClass')).toBeInTheDocument();
    });
  });

  it('shows checkin buttons only for active classes for students', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<ClassesPage />);

    await screen.findByText('Morning Gi');
    // Active class (today, current hour) should show checkin button
    const checkinButtons = screen.getAllByText('classes.checkinProximity');
    expect(checkinButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no classes', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<ClassesPage />);
    expect(await screen.findByText('common.noResults')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/pages/classes.test.tsx`
Expected: FAIL — `classes.checkinProximity` not found

- [ ] **Step 3: Update classes page with smart checkin buttons**

Replace `apps/web/src/pages/classes/index.tsx` with smart checkin logic. Key changes:
- Add `isClassActiveNow` client-side check (same logic as server, for UX only)
- Replace single "Check-in" button with two buttons: proximity + QR scan
- Only show buttons for today's active classes
- Fetch student's today checkins to show "checked in" state
- Add QR scanner modal using html5-qrcode

The student section of each class card becomes:

```typescript
{user?.role === 'student' && isActiveNow(c) && !isCheckedIn(c.id) && (
  <div className="flex gap-2 mt-2">
    <Button
      variant="outline"
      className="flex-1"
      onClick={() => handleProximityCheckin(c.id)}
      disabled={checkinMutation.isPending}
    >
      {t('classes.checkinProximity')}
    </Button>
    <Button
      variant="outline"
      onClick={() => openScanner(c.id)}
    >
      {t('classes.checkinQR')}
    </Button>
  </div>
)}
{user?.role === 'student' && isCheckedIn(c.id) && (
  <p className="text-primary font-bold mt-2">{t('classes.checkedIn')}</p>
)}
```

The proximity handler requests geolocation and sends to server:

```typescript
function handleProximityCheckin(classId: string) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      checkinMutation.mutate({
        classId,
        source: 'button' as const,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    },
    () => {
      setCheckinMsg(t('classes.checkinTooFar'));
    },
  );
}
```

Add a client-side `isActiveNow` function (mirrors server logic, UX-only):

```typescript
function isActiveNow(cls: ClassItem): boolean {
  const now = new Date();
  if (cls.dayOfWeek !== now.getDay()) return false;
  const [startH, startM] = cls.startTime.split(':').map(Number);
  const [endH, endM] = cls.endTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= startH * 60 + startM - 15 && nowMin <= endH * 60 + endM + 60;
}
```

Fetch today's checkins to determine checked-in state:

```typescript
const { data: myCheckins = [] } = useApiQuery<{ classId: string }[]>(
  ['my-checkins', user?.id],
  `/checkins/student/${user?.id}`,
  !!user?.id && user?.role === 'student',
);

function isCheckedIn(classId: string): boolean {
  const today = new Date().toDateString();
  return myCheckins.some(
    (c: any) => c.classId === classId && new Date(c.checkedInAt).toDateString() === today,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/pages/classes.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/classes/index.tsx apps/web/test/pages/classes.test.tsx
git commit -m "feat: update classes page with proximity and QR checkin buttons"
```

---

### Task 12: Add Routes to App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add imports and routes**

Add imports at top of `apps/web/src/App.tsx`:

```typescript
import TotemPage from './pages/totem';
import CheckinScanPage from './pages/checkin-scan';
```

Add `/checkin` route to the unauthenticated block (so it works before redirect, since QR scan may arrive before login state resolves — the page handles the redirect internally):

```typescript
<Route path="/checkin" element={<CheckinScanPage />} />
```

Add `/totem` route to the authenticated instructor routes (inside the `<Route element={<AppLayout />}>` block or as a standalone route without layout, since totem should be fullscreen):

Add before the `<Route element={<AppLayout />}>`:

```typescript
<Route path="/totem" element={<TotemPage />} />
```

Also add `/checkin` to the authenticated routes:

```typescript
<Route path="/checkin" element={<CheckinScanPage />} />
```

- [ ] **Step 2: Run routing tests**

Run: `cd apps/web && npx vitest run test/pages/routing.test.tsx`
Expected: PASS (existing routing tests should not break)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: add totem and checkin scan routes"
```

---

### Task 13: Generate and Apply Migration

**Files:**
- Create: `apps/api/drizzle/` (new migration files)

- [ ] **Step 1: Generate migration**

```bash
cd apps/api && npx drizzle-kit generate
```

Review the generated migration SQL. It should include:
- `ALTER TABLE academy ADD COLUMN latitude, longitude, address`
- `ALTER TABLE checkin ADD COLUMN source, latitude, longitude`
- `CREATE TYPE checkin_source`
- `CREATE TABLE checkin_token`
- `CREATE UNIQUE INDEX checkin_class_student_day_idx`

If the expression-based unique index (`DATE(checked_in_at)`) is not generated correctly by Drizzle, create a manual migration file with:

```sql
CREATE UNIQUE INDEX checkin_class_student_day_idx ON checkin (class_id, student_id, DATE(checked_in_at));
```

- [ ] **Step 2: Run migration against test DB**

```bash
cd apps/api && DATABASE_URL=postgresql://postgres:postgres@localhost:5433/pgt_test npx drizzle-kit migrate
```

- [ ] **Step 3: Run full test suite**

```bash
cd apps/api && npx vitest run
cd apps/web && npx vitest run
```

Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/drizzle/
git commit -m "feat: add database migration for smart checkin system"
```

---

### Task 14: Final Integration Verification

- [ ] **Step 1: Run complete test suite**

```bash
cd apps/api && npx vitest run && cd ../web && npx vitest run
```

Expected: ALL PASS

- [ ] **Step 2: Start dev server and test manually**

```bash
# Terminal 1
cd apps/api && npm run dev

# Terminal 2
cd apps/web && npm run dev
```

Verify:
- Student sees checkin buttons only for active classes
- Proximity checkin works (browser asks for location)
- Instructor can access `/totem` and sees QR codes
- QR scan landing page processes checkins

- [ ] **Step 3: Commit any final adjustments**

```bash
git add -A && git commit -m "chore: final adjustments for smart checkin system"
```
