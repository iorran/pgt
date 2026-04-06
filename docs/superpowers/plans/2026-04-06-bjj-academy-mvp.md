# BJJ Academy App — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-tenant web app for BJJ academy management — classes, billing, marketplace, gamification, and tournaments.

**Architecture:** Turborepo monorepo with a React + Vite frontend and Fastify + Drizzle backend. PostgreSQL for storage. BetterAuth for authentication. Multi-tenant via `academy_id` on every entity. pt-BR as default language with react-i18next.

**Tech Stack:** React, Vite, Fastify, Drizzle ORM, PostgreSQL, BetterAuth, Turborepo, react-i18next, Vitest

---

## Phase Overview

| Phase | What It Delivers | Depends On |
|---|---|---|
| 0 — Foundation | Monorepo, DB schema, auth, i18n, app shell | Nothing |
| 1 — Classes & Check-in | Schedule, check-in, attendance | Phase 0 |
| 2 — Billing & Membership | Plans, payments, alerts, overdue dashboard | Phase 0 |
| 3 — Marketplace | Product catalog, orders | Phase 0 |
| 4 — Gamification | Seasons, rankings, streaks, badges, XP | Phase 0 |
| 5 — Tournaments | Listings, sign-ups, roster | Phase 0 |

> Phases 1–5 are independent of each other and can be built in any order or in parallel.

---

## File Structure

```
pgt/
├── apps/
│   ├── api/                          # Fastify backend
│   │   ├── src/
│   │   │   ├── index.ts              # Server entry point
│   │   │   ├── env.ts                # Environment config
│   │   │   ├── db/
│   │   │   │   ├── client.ts         # Drizzle client instance
│   │   │   │   ├── schema/
│   │   │   │   │   ├── index.ts      # Re-exports all schemas
│   │   │   │   │   ├── academy.ts
│   │   │   │   │   ├── auth.ts       # BetterAuth tables
│   │   │   │   │   ├── user.ts
│   │   │   │   │   ├── class.ts
│   │   │   │   │   ├── checkin.ts
│   │   │   │   │   ├── membership.ts
│   │   │   │   │   ├── payment.ts
│   │   │   │   │   ├── product.ts
│   │   │   │   │   ├── order.ts
│   │   │   │   │   ├── season.ts
│   │   │   │   │   ├── competition-result.ts
│   │   │   │   │   ├── tournament.ts
│   │   │   │   │   ├── gamification.ts  # Badge, XP, Streak
│   │   │   │   │   └── index.ts
│   │   │   │   ├── migrate.ts
│   │   │   │   └── seed.ts
│   │   │   ├── auth/
│   │   │   │   └── index.ts          # BetterAuth server config
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # Session verification
│   │   │   │   └── tenant.ts         # Academy scoping
│   │   │   └── routes/
│   │   │       ├── auth.ts           # Auth routes (proxy to BetterAuth)
│   │   │       ├── academy.ts
│   │   │       ├── classes.ts
│   │   │       ├── checkins.ts
│   │   │       ├── students.ts
│   │   │       ├── membership-plans.ts
│   │   │       ├── payments.ts
│   │   │       ├── products.ts
│   │   │       ├── orders.ts
│   │   │       ├── seasons.ts
│   │   │       ├── competition-results.ts
│   │   │       ├── tournaments.ts
│   │   │       └── gamification.ts
│   │   ├── test/
│   │   │   ├── helpers.ts            # Test factory + setup
│   │   │   ├── classes.test.ts
│   │   │   ├── checkins.test.ts
│   │   │   ├── payments.test.ts
│   │   │   ├── products.test.ts
│   │   │   ├── orders.test.ts
│   │   │   ├── seasons.test.ts
│   │   │   ├── competition-results.test.ts
│   │   │   ├── tournaments.test.ts
│   │   │   └── gamification.test.ts
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── web/                          # React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx               # Router + layout
│       │   ├── i18n/
│       │   │   ├── index.ts          # i18n init
│       │   │   ├── pt-BR.json
│       │   │   └── en.json
│       │   ├── lib/
│       │   │   ├── api.ts            # Fetch wrapper
│       │   │   └── auth-client.ts    # BetterAuth React client
│       │   ├── hooks/
│       │   │   ├── use-auth.ts
│       │   │   └── use-api.ts
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── sidebar.tsx
│       │   │   │   ├── header.tsx
│       │   │   │   └── app-layout.tsx
│       │   │   ├── ui/               # Shared UI primitives
│       │   │   └── ...
│       │   └── pages/
│       │       ├── login.tsx
│       │       ├── signup.tsx
│       │       ├── dashboard.tsx
│       │       ├── classes/
│       │       │   ├── index.tsx       # Class list + schedule
│       │       │   └── checkin.tsx     # Student check-in view
│       │       ├── students/
│       │       │   ├── index.tsx       # Student registry
│       │       │   └── [id].tsx        # Student profile
│       │       ├── billing/
│       │       │   ├── index.tsx       # Overdue dashboard
│       │       │   ├── plans.tsx       # Membership plans
│       │       │   └── payments.tsx    # Payment history
│       │       ├── marketplace/
│       │       │   ├── index.tsx       # Product catalog
│       │       │   └── orders.tsx      # Order management
│       │       ├── gamification/
│       │       │   ├── seasons.tsx     # Season management
│       │       │   ├── leaderboard.tsx
│       │       │   ├── results.tsx     # Competition results approval
│       │       │   └── profile.tsx     # Student gamification profile
│       │       └── tournaments/
│       │           └── index.tsx
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types.ts              # Shared TypeScript types
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── turbo.json
├── package.json
├── tsconfig.base.json
└── .env.example
```

---

## Phase 0: Foundation

### Task 1: Initialize Turborepo Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create root monorepo structure**

```bash
cd /Users/iorran/pgt
npm init -y
npm install turbo -D
```

- [ ] **Step 2: Configure root `package.json`**

```json
{
  "name": "pgt",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "db:generate": "turbo db:generate --filter=@pgt/api",
    "db:migrate": "turbo db:migrate --filter=@pgt/api",
    "db:seed": "turbo db:seed --filter=@pgt/api"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

- [ ] **Step 3: Configure `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "db:generate": { "cache": false },
    "db:migrate": { "cache": false },
    "db:seed": { "cache": false }
  }
}
```

- [ ] **Step 4: Configure `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 5: Create `.env.example` and `.gitignore`**

`.env.example`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pgt
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:3000
VITE_API_URL=http://localhost:3000
```

`.gitignore`:
```
node_modules/
dist/
.env
.turbo/
*.tsbuildinfo
```

- [ ] **Step 6: Commit**

```bash
git init
git add package.json turbo.json tsconfig.base.json .env.example .gitignore
git commit -m "chore: init turborepo monorepo"
```

---

### Task 2: Create Shared Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Initialize shared package**

```bash
mkdir -p packages/shared/src
```

`packages/shared/package.json`:
```json
{
  "name": "@pgt/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "tsc --noEmit"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src"]
}
```

- [ ] **Step 2: Define shared types**

`packages/shared/src/types.ts`:
```typescript
export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black';
export type UserRole = 'instructor' | 'student';
export type ClassType = 'gi' | 'no-gi' | 'open-mat' | 'kids';
export type Recurrence = 'once' | 'weekly';
export type PlanFrequency = 'monthly' | 'quarterly' | 'yearly';
export type OrderStatus = 'requested' | 'confirmed' | 'delivered' | 'cancelled';
export type ResultStatus = 'pending' | 'approved' | 'rejected';
export type XPSourceType = 'checkin' | 'competition' | 'badge';

export const BELTS: Belt[] = ['white', 'blue', 'purple', 'brown', 'black'];
export const KID_AGE_LIMIT = 16;
```

`packages/shared/src/index.ts`:
```typescript
export * from './types';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared
git commit -m "chore: add shared types package"
```

---

### Task 3: Setup API App — Fastify + Drizzle

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Initialize API package**

```bash
mkdir -p apps/api/src/db/schema apps/api/src/routes apps/api/src/middleware apps/api/src/auth apps/api/test
```

`apps/api/package.json`:
```json
{
  "name": "@pgt/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/db/seed.ts"
  },
  "dependencies": {
    "@pgt/shared": "workspace:*",
    "fastify": "^5",
    "@fastify/cors": "^10",
    "@fastify/cookie": "^11",
    "drizzle-orm": "^0.39",
    "postgres": "^3",
    "better-auth": "^1",
    "zod": "^3",
    "dotenv": "^16"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30",
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^3",
    "@types/node": "^22"
  }
}
```

- [ ] **Step 2: Configure TypeScript and Drizzle**

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`apps/api/drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Create env config and DB client**

`apps/api/src/env.ts`:
```typescript
import 'dotenv/config';

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
};
```

`apps/api/src/db/client.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema/index.js';

const connection = postgres(env.DATABASE_URL);
export const db = drizzle(connection, { schema });
```

- [ ] **Step 4: Create Fastify server entry point**

`apps/api/src/index.ts`:
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './env.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(cookie);

app.get('/health', async () => ({ status: 'ok' }));

await app.listen({ port: env.PORT, host: '0.0.0.0' });
console.log(`API running on http://localhost:${env.PORT}`);
```

- [ ] **Step 5: Install dependencies and verify**

```bash
cd /Users/iorran/pgt
npm install
cp .env.example .env  # Edit DATABASE_URL with your local Postgres
cd apps/api && npx tsx src/index.ts
# Expect: API running on http://localhost:3000
# Ctrl+C to stop
```

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "chore: setup fastify api app with drizzle"
```

---

### Task 4: Define Database Schema (All Tables)

**Files:**
- Create: `apps/api/src/db/schema/academy.ts`
- Create: `apps/api/src/db/schema/user.ts`
- Create: `apps/api/src/db/schema/auth.ts`
- Create: `apps/api/src/db/schema/class.ts`
- Create: `apps/api/src/db/schema/checkin.ts`
- Create: `apps/api/src/db/schema/membership.ts`
- Create: `apps/api/src/db/schema/payment.ts`
- Create: `apps/api/src/db/schema/product.ts`
- Create: `apps/api/src/db/schema/order.ts`
- Create: `apps/api/src/db/schema/season.ts`
- Create: `apps/api/src/db/schema/competition-result.ts`
- Create: `apps/api/src/db/schema/tournament.ts`
- Create: `apps/api/src/db/schema/gamification.ts`
- Create: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Academy schema**

`apps/api/src/db/schema/academy.ts`:
```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const academy = pgTable('academy', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  logoUrl: varchar('logo_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

- [ ] **Step 2: User schema (extends BetterAuth)**

`apps/api/src/db/schema/user.ts`:
```typescript
import { pgTable, uuid, varchar, date, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { academy } from './academy.js';

export const beltEnum = pgEnum('belt', ['white', 'blue', 'purple', 'brown', 'black']);
export const userRoleEnum = pgEnum('user_role', ['instructor', 'student']);

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified'),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  dateOfBirth: date('date_of_birth'),
  belt: beltEnum('belt').default('white').notNull(),
  role: userRoleEnum('role').default('student').notNull(),
  image: varchar('image', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

- [ ] **Step 3: BetterAuth tables (session, account, verification)**

`apps/api/src/db/schema/auth.ts`:
```typescript
import { pgTable, uuid, varchar, timestamp, text, boolean, integer } from 'drizzle-orm/pg-core';
import { user } from './user.js';

export const session = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const account = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const verification = pgTable('verification', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

- [ ] **Step 4: Class and Checkin schemas**

`apps/api/src/db/schema/class.ts`:
```typescript
import { pgTable, uuid, varchar, time, date, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { academy } from './academy.js';
import { user } from './user.js';

export const classTypeEnum = pgEnum('class_type', ['gi', 'no-gi', 'open-mat', 'kids']);
export const recurrenceEnum = pgEnum('recurrence', ['once', 'weekly']);

export const bjjClass = pgTable('class', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  instructorId: uuid('instructor_id').notNull().references(() => user.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: classTypeEnum('type').notNull(),
  recurrence: recurrenceEnum('recurrence').notNull(),
  dayOfWeek: integer('day_of_week'),
  date: date('date'),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  active: boolean('active').default(true).notNull(),
});
```

`apps/api/src/db/schema/checkin.ts`:
```typescript
import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { bjjClass } from './class.js';
import { user } from './user.js';

export const checkin = pgTable('checkin', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => bjjClass.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  checkedInAt: timestamp('checked_in_at').defaultNow().notNull(),
}, (table) => [
  index('checkin_student_date_idx').on(table.studentId, table.checkedInAt),
  index('checkin_class_idx').on(table.classId),
]);
```

- [ ] **Step 5: Membership and Payment schemas**

`apps/api/src/db/schema/membership.ts`:
```typescript
import { pgTable, uuid, varchar, decimal, integer, boolean, date, pgEnum } from 'drizzle-orm/pg-core';
import { academy } from './academy.js';
import { user } from './user.js';

export const planFrequencyEnum = pgEnum('plan_frequency', ['monthly', 'quarterly', 'yearly']);

export const membershipPlan = pgTable('membership_plan', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  frequency: planFrequencyEnum('frequency').notNull(),
  classesPerWeek: integer('classes_per_week'),
  active: boolean('active').default(true).notNull(),
});

export const studentMembership = pgTable('student_membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  planId: uuid('plan_id').notNull().references(() => membershipPlan.id),
  startDate: date('start_date').notNull(),
  dueDay: integer('due_day').notNull(),
  active: boolean('active').default(true).notNull(),
});
```

`apps/api/src/db/schema/payment.ts`:
```typescript
import { pgTable, uuid, decimal, date, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './user.js';
import { academy } from './academy.js';

export const payment = pgTable('payment', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  referenceMonth: varchar('reference_month', { length: 7 }).notNull(),
  recordedBy: uuid('recorded_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('payment_student_month_idx').on(table.studentId, table.referenceMonth),
]);
```

- [ ] **Step 6: Product and Order schemas**

`apps/api/src/db/schema/product.ts`:
```typescript
import { pgTable, uuid, varchar, decimal, integer, boolean, text } from 'drizzle-orm/pg-core';
import { academy } from './academy.js';

export const product = pgTable('product', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  photoUrl: varchar('photo_url', { length: 500 }),
  stock: integer('stock').default(0).notNull(),
  active: boolean('active').default(true).notNull(),
});
```

`apps/api/src/db/schema/order.ts`:
```typescript
import { pgTable, uuid, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { product } from './product.js';
import { user } from './user.js';

export const orderStatusEnum = pgEnum('order_status', ['requested', 'confirmed', 'delivered', 'cancelled']);

export const order = pgTable('order', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => product.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  quantity: integer('quantity').default(1).notNull(),
  status: orderStatusEnum('status').default('requested').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

- [ ] **Step 7: Season and Competition Result schemas**

`apps/api/src/db/schema/season.ts`:
```typescript
import { pgTable, uuid, varchar, date, jsonb, boolean, text } from 'drizzle-orm/pg-core';
import { academy } from './academy.js';

export const season = pgTable('season', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  pointsConfig: jsonb('points_config').notNull().$type<Record<number, number>>(),
  prizeDescription: text('prize_description'),
  active: boolean('active').default(true).notNull(),
});
```

`apps/api/src/db/schema/competition-result.ts`:
```typescript
import { pgTable, uuid, varchar, date, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { season } from './season.js';
import { user } from './user.js';

export const resultStatusEnum = pgEnum('result_status', ['pending', 'approved', 'rejected']);

export const competitionResult = pgTable('competition_result', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => season.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  competitionName: varchar('competition_name', { length: 255 }).notNull(),
  competitionDate: date('competition_date').notNull(),
  position: integer('position').notNull(),
  pointsAwarded: integer('points_awarded').default(0).notNull(),
  status: resultStatusEnum('status').default('pending').notNull(),
  submittedBy: uuid('submitted_by').notNull().references(() => user.id),
  reviewedBy: uuid('reviewed_by').references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('result_season_student_idx').on(table.seasonId, table.studentId, table.status),
]);
```

- [ ] **Step 8: Tournament schema**

`apps/api/src/db/schema/tournament.ts`:
```typescript
import { pgTable, uuid, varchar, date, timestamp } from 'drizzle-orm/pg-core';
import { academy } from './academy.js';
import { user } from './user.js';

export const tournament = pgTable('tournament', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  date: date('date').notNull(),
  location: varchar('location', { length: 500 }),
  federation: varchar('federation', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tournamentSignup = pgTable('tournament_signup', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournament.id),
  studentId: uuid('student_id').notNull().references(() => user.id),
  weightClass: varchar('weight_class', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

- [ ] **Step 9: Gamification schemas (Badge, XP, Streak)**

`apps/api/src/db/schema/gamification.ts`:
```typescript
import { pgTable, uuid, varchar, text, integer, timestamp, date, pgEnum } from 'drizzle-orm/pg-core';
import { academy } from './academy.js';
import { user } from './user.js';

export const xpSourceTypeEnum = pgEnum('xp_source_type', ['checkin', 'competition', 'badge']);

export const badgeDefinition = pgTable('badge_definition', {
  id: uuid('id').primaryKey().defaultRandom(),
  academyId: uuid('academy_id').notNull().references(() => academy.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 255 }),
  criteriaType: varchar('criteria_type', { length: 100 }).notNull(),
  criteriaValue: integer('criteria_value').notNull(),
});

export const studentBadge = pgTable('student_badge', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  badgeDefinitionId: uuid('badge_definition_id').notNull().references(() => badgeDefinition.id),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
});

export const xpEntry = pgTable('xp_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id),
  xpAmount: integer('xp_amount').notNull(),
  sourceType: xpSourceTypeEnum('source_type').notNull(),
  sourceId: uuid('source_id'),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
});

export const streak = pgTable('streak', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => user.id).unique(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastCheckinWeek: date('last_checkin_week'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

- [ ] **Step 10: Create schema index file**

`apps/api/src/db/schema/index.ts`:
```typescript
export * from './academy.js';
export * from './user.js';
export * from './auth.js';
export * from './class.js';
export * from './checkin.js';
export * from './membership.js';
export * from './payment.js';
export * from './product.js';
export * from './order.js';
export * from './season.js';
export * from './competition-result.js';
export * from './tournament.js';
export * from './gamification.js';
```

- [ ] **Step 11: Generate and run migration**

```bash
cd /Users/iorran/pgt
# Make sure Postgres is running and DATABASE_URL is set in .env
npm run db:generate
npm run db:migrate
```

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/db/schema apps/api/drizzle
git commit -m "feat: define complete database schema with drizzle"
```

---

### Task 5: Setup BetterAuth

**Files:**
- Create: `apps/api/src/auth/index.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/middleware/tenant.ts`
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Configure BetterAuth server**

`apps/api/src/auth/index.ts`:
```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client.js';
import { env } from '../env.js';
import * as schema from '../db/schema/index.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      academyId: { type: 'string', required: true, input: true },
      phone: { type: 'string', required: false, input: true },
      dateOfBirth: { type: 'string', required: false, input: true },
      belt: { type: 'string', required: false, input: true, defaultValue: 'white' },
      role: { type: 'string', required: false, input: true, defaultValue: 'student' },
    },
  },
});
```

- [ ] **Step 2: Create auth middleware**

`apps/api/src/middleware/auth.ts`:
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../auth/index.js';
import { fromNodeHeaders } from 'better-auth/node';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  request.session = session.session;
  request.user = session.user;
}

export async function requireInstructor(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (request.user.role !== 'instructor') {
    return reply.status(403).send({ error: 'Forbidden: instructor only' });
  }
}
```

- [ ] **Step 3: Create tenant middleware**

`apps/api/src/middleware/tenant.ts`:
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

export async function injectAcademyId(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.academyId) {
    return reply.status(400).send({ error: 'No academy associated' });
  }
  request.academyId = request.user.academyId;
}
```

- [ ] **Step 4: Create auth routes**

`apps/api/src/routes/auth.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { auth } from '../auth/index.js';
import { toNodeHandler } from 'better-auth/node';

export async function authRoutes(app: FastifyInstance) {
  app.all('/api/auth/*', async (request, reply) => {
    const handler = toNodeHandler(auth);
    // @ts-ignore - bridge Fastify <-> Node handler
    return handler(request.raw, reply.raw);
  });
}
```

- [ ] **Step 5: Wire everything into the server**

Update `apps/api/src/index.ts`:
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './env.js';
import { authRoutes } from './routes/auth.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(cookie);

// Fastify type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    session: any;
    user: any;
    academyId: string;
  }
}

// Routes
await app.register(authRoutes);

app.get('/health', async () => ({ status: 'ok' }));

await app.listen({ port: env.PORT, host: '0.0.0.0' });
console.log(`API running on http://localhost:${env.PORT}`);
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth apps/api/src/middleware apps/api/src/routes/auth.ts apps/api/src/index.ts
git commit -m "feat: setup betterauth with session and tenant middleware"
```

---

### Task 6: Setup React Frontend App

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/auth-client.ts`

- [ ] **Step 1: Initialize web package**

```bash
mkdir -p apps/web/src/lib apps/web/src/pages apps/web/src/components/layout apps/web/src/components/ui apps/web/src/hooks apps/web/src/i18n
```

`apps/web/package.json`:
```json
{
  "name": "@pgt/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "tsc --noEmit",
    "preview": "vite preview"
  },
  "dependencies": {
    "@pgt/shared": "workspace:*",
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "better-auth": "^1",
    "i18next": "^24",
    "react-i18next": "^15"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5",
    "vite": "^6"
  }
}
```

- [ ] **Step 2: Configure Vite and TypeScript**

`apps/web/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "noEmit": true
  },
  "include": ["src"]
}
```

`apps/web/index.html`:
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PGT — Academia BJJ</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 3: Create auth client and API wrapper**

`apps/web/src/lib/auth-client.ts`:
```typescript
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: '/api/auth',
});

export const { useSession, signIn, signUp, signOut } = authClient;
```

`apps/web/src/lib/api.ts`:
```typescript
const API_BASE = '/api';

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}
```

- [ ] **Step 4: Setup i18n**

`apps/web/src/i18n/pt-BR.json`:
```json
{
  "app": {
    "name": "PGT",
    "tagline": "Gestão de Academia BJJ"
  },
  "nav": {
    "dashboard": "Painel",
    "classes": "Aulas",
    "students": "Alunos",
    "billing": "Financeiro",
    "marketplace": "Loja",
    "gamification": "Ranking",
    "tournaments": "Campeonatos"
  },
  "auth": {
    "login": "Entrar",
    "signup": "Criar Conta",
    "logout": "Sair",
    "email": "E-mail",
    "password": "Senha",
    "name": "Nome"
  },
  "common": {
    "save": "Salvar",
    "cancel": "Cancelar",
    "delete": "Excluir",
    "edit": "Editar",
    "create": "Criar",
    "search": "Buscar",
    "loading": "Carregando...",
    "noResults": "Nenhum resultado",
    "confirm": "Confirmar",
    "back": "Voltar"
  }
}
```

`apps/web/src/i18n/en.json`:
```json
{
  "app": {
    "name": "PGT",
    "tagline": "BJJ Academy Management"
  },
  "nav": {
    "dashboard": "Dashboard",
    "classes": "Classes",
    "students": "Students",
    "billing": "Billing",
    "marketplace": "Marketplace",
    "gamification": "Ranking",
    "tournaments": "Tournaments"
  },
  "auth": {
    "login": "Log In",
    "signup": "Sign Up",
    "logout": "Log Out",
    "email": "Email",
    "password": "Password",
    "name": "Name"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "loading": "Loading...",
    "noResults": "No results",
    "confirm": "Confirm",
    "back": "Back"
  }
}
```

`apps/web/src/i18n/index.ts`:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from './pt-BR.json';
import en from './en.json';

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    en: { translation: en },
  },
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 5: Create app entry and router shell**

`apps/web/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

`apps/web/src/App.tsx`:
```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './lib/auth-client';

function App() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Carregando...</div>;

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<div>Login Page (TODO)</div>} />
        <Route path="/signup" element={<div>Signup Page (TODO)</div>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<div>Dashboard (TODO)</div>} />
      <Route path="/classes" element={<div>Classes (TODO)</div>} />
      <Route path="/students" element={<div>Students (TODO)</div>} />
      <Route path="/billing" element={<div>Billing (TODO)</div>} />
      <Route path="/marketplace" element={<div>Marketplace (TODO)</div>} />
      <Route path="/gamification" element={<div>Gamification (TODO)</div>} />
      <Route path="/tournaments" element={<div>Tournaments (TODO)</div>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
```

- [ ] **Step 6: Install deps and verify**

```bash
cd /Users/iorran/pgt
npm install
cd apps/web && npx vite --open
# Expect: browser opens with "Login Page (TODO)"
```

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: setup react frontend with vite, i18n, and auth client"
```

---

### Task 7: Setup Test Infrastructure

**Files:**
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/test/helpers.ts`
- Create: `apps/api/src/app.ts` (extract app factory from index.ts)
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Extract Fastify app factory for testability**

`apps/api/src/app.ts`:
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { authRoutes } from './routes/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: any;
    user: any;
    academyId: string;
  }
}

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(authRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

Update `apps/api/src/index.ts`:
```typescript
import { buildApp } from './app.js';
import { env } from './env.js';

const app = await buildApp();
await app.listen({ port: env.PORT, host: '0.0.0.0' });
console.log(`API running on http://localhost:${env.PORT}`);
```

- [ ] **Step 2: Configure Vitest**

`apps/api/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
  },
});
```

- [ ] **Step 3: Create test helpers**

`apps/api/test/helpers.ts`:
```typescript
import { db } from '../src/db/client.js';
import { buildApp } from '../src/app.js';
import { academy, user } from '../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

export async function createTestApp() {
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function createTestAcademy(name = 'Test Academy') {
  const [result] = await db.insert(academy).values({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
  }).returning();
  return result;
}

export async function createTestUser(academyId: string, overrides: Partial<typeof user.$inferInsert> = {}) {
  const [result] = await db.insert(user).values({
    academyId,
    email: `test-${Date.now()}@test.com`,
    name: 'Test User',
    role: 'student',
    belt: 'white',
    ...overrides,
  }).returning();
  return result;
}

export async function cleanupTest() {
  // Delete in reverse FK order
  // In a real setup, use a test DB and truncate
}
```

- [ ] **Step 4: Verify test setup**

```bash
cd /Users/iorran/pgt/apps/api
npx vitest run
# Expect: no tests found (yet), exits cleanly
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/index.ts apps/api/vitest.config.ts apps/api/test
git commit -m "feat: setup vitest and test helpers, extract app factory"
```

---

### Task 8: Seed Script

**Files:**
- Create: `apps/api/src/db/seed.ts`

- [ ] **Step 1: Create seed script with demo data**

`apps/api/src/db/seed.ts`:
```typescript
import 'dotenv/config';
import { db } from './client.js';
import { academy, user, bjjClass, membershipPlan, badgeDefinition, season } from './schema/index.js';

async function seed() {
  console.log('Seeding database...');

  // Academy
  const [acad] = await db.insert(academy).values({
    name: 'Alliance São Paulo',
    slug: 'alliance-sp',
  }).returning();

  // Instructor
  const [instructor] = await db.insert(user).values({
    academyId: acad.id,
    email: 'professor@alliance.com',
    name: 'Professor Silva',
    role: 'instructor',
    belt: 'black',
    dateOfBirth: '1985-03-15',
  }).returning();

  // Students
  const students = await db.insert(user).values([
    { academyId: acad.id, email: 'joao@test.com', name: 'João Santos', role: 'student', belt: 'blue', dateOfBirth: '1995-06-20' },
    { academyId: acad.id, email: 'maria@test.com', name: 'Maria Oliveira', role: 'student', belt: 'purple', dateOfBirth: '1992-11-10' },
    { academyId: acad.id, email: 'pedro@test.com', name: 'Pedro Junior', role: 'student', belt: 'white', dateOfBirth: '2013-08-05' },
  ]).returning();

  // Classes
  await db.insert(bjjClass).values([
    { academyId: acad.id, instructorId: instructor.id, name: 'Gi Manhã', type: 'gi', recurrence: 'weekly', dayOfWeek: 1, startTime: '07:00', endTime: '08:30' },
    { academyId: acad.id, instructorId: instructor.id, name: 'No-Gi Noite', type: 'no-gi', recurrence: 'weekly', dayOfWeek: 3, startTime: '19:00', endTime: '20:30' },
    { academyId: acad.id, instructorId: instructor.id, name: 'Kids', type: 'kids', recurrence: 'weekly', dayOfWeek: 6, startTime: '10:00', endTime: '11:00' },
  ]);

  // Membership Plans
  await db.insert(membershipPlan).values([
    { academyId: acad.id, name: 'Mensal Ilimitado', price: '250.00', frequency: 'monthly', classesPerWeek: null },
    { academyId: acad.id, name: '2x por Semana', price: '180.00', frequency: 'monthly', classesPerWeek: 2 },
    { academyId: acad.id, name: 'Aula Avulsa', price: '50.00', frequency: 'monthly', classesPerWeek: 1 },
  ]);

  // Season
  await db.insert(season).values({
    academyId: acad.id,
    name: 'Ranking 2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    pointsConfig: { 1: 10, 2: 7, 3: 5 },
    prizeDescription: 'Gi novo da Shoyoroll',
    active: true,
  });

  // Badge Definitions
  await db.insert(badgeDefinition).values([
    { academyId: acad.id, name: '100 Aulas', description: 'Completou 100 aulas', icon: '💯', criteriaType: 'classes_count', criteriaValue: 100 },
    { academyId: acad.id, name: 'Primeira Competição', description: 'Competiu pela primeira vez', icon: '🥋', criteriaType: 'first_competition', criteriaValue: 1 },
    { academyId: acad.id, name: 'Mês Perfeito', description: 'Treinou todas as semanas do mês', icon: '🔥', criteriaType: 'perfect_month', criteriaValue: 4 },
  ]);

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Run seed**

```bash
cd /Users/iorran/pgt
npm run db:seed
# Expect: "Seed complete!"
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/seed.ts
git commit -m "feat: add seed script with demo academy data"
```

---

## Phase 1: Classes & Check-in

### Task 9: Class CRUD Routes

**Files:**
- Create: `apps/api/src/routes/classes.ts`
- Create: `apps/api/test/classes.test.ts`
- Modify: `apps/api/src/app.ts` — register route

- [ ] **Step 1: Write failing test for list classes**

`apps/api/test/classes.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, createTestAcademy, createTestUser } from './helpers';
import { db } from '../src/db/client';
import { bjjClass } from '../src/db/schema';

describe('GET /api/classes', () => {
  it('returns classes for the academy', async () => {
    const app = await createTestApp();
    const academy = await createTestAcademy();
    const instructor = await createTestUser(academy.id, { role: 'instructor' });

    await db.insert(bjjClass).values({
      academyId: academy.id,
      instructorId: instructor.id,
      name: 'Gi Manhã',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/classes?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Gi Manhã');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/iorran/pgt/apps/api
npx vitest run test/classes.test.ts
# Expect: FAIL — route not found
```

- [ ] **Step 3: Implement class routes**

`apps/api/src/routes/classes.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { bjjClass } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';

export async function classRoutes(app: FastifyInstance) {
  // List classes for academy
  app.get('/api/classes', async (request) => {
    const { academyId } = request.query as { academyId: string };
    return db.select().from(bjjClass).where(eq(bjjClass.academyId, academyId));
  });

  // Create class (instructor only)
  app.post('/api/classes', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    const [created] = await db.insert(bjjClass).values({
      academyId: request.academyId,
      instructorId: request.user.id,
      name: body.name,
      type: body.type,
      recurrence: body.recurrence,
      dayOfWeek: body.dayOfWeek,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
    }).returning();
    return reply.status(201).send(created);
  });

  // Update class
  app.put('/api/classes/:id', { preHandler: [requireInstructor, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const [updated] = await db.update(bjjClass)
      .set(body)
      .where(and(eq(bjjClass.id, id), eq(bjjClass.academyId, request.academyId)))
      .returning();
    return updated;
  });

  // Delete (deactivate) class
  app.delete('/api/classes/:id', { preHandler: [requireInstructor, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const [updated] = await db.update(bjjClass)
      .set({ active: false })
      .where(and(eq(bjjClass.id, id), eq(bjjClass.academyId, request.academyId)))
      .returning();
    return updated;
  });
}
```

- [ ] **Step 4: Register route in app.ts**

Add to `apps/api/src/app.ts`:
```typescript
import { classRoutes } from './routes/classes.js';
// ... inside buildApp():
await app.register(classRoutes);
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run test/classes.test.ts
# Expect: PASS
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/classes.ts apps/api/test/classes.test.ts apps/api/src/app.ts
git commit -m "feat: add class CRUD routes with tests"
```

---

### Task 10: Check-in Routes

**Files:**
- Create: `apps/api/src/routes/checkins.ts`
- Create: `apps/api/test/checkins.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write failing test for student check-in**

`apps/api/test/checkins.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createTestApp, createTestAcademy, createTestUser } from './helpers';
import { db } from '../src/db/client';
import { bjjClass, checkin } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('POST /api/checkins', () => {
  it('creates a checkin for a class', async () => {
    const app = await createTestApp();
    const academy = await createTestAcademy();
    const instructor = await createTestUser(academy.id, { role: 'instructor' });
    const student = await createTestUser(academy.id, { role: 'student' });

    const [cls] = await db.insert(bjjClass).values({
      academyId: academy.id,
      instructorId: instructor.id,
      name: 'Gi',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      payload: { classId: cls.id, studentId: student.id },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.studentId).toBe(student.id);
    expect(body.classId).toBe(cls.id);
  });
});

describe('GET /api/checkins/class/:classId', () => {
  it('returns attendance for a class', async () => {
    const app = await createTestApp();
    const academy = await createTestAcademy();
    const instructor = await createTestUser(academy.id, { role: 'instructor' });
    const student = await createTestUser(academy.id, { role: 'student' });

    const [cls] = await db.insert(bjjClass).values({
      academyId: academy.id,
      instructorId: instructor.id,
      name: 'Gi',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    }).returning();

    await db.insert(checkin).values({ classId: cls.id, studentId: student.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/class/${cls.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/checkins.test.ts
# Expect: FAIL
```

- [ ] **Step 3: Implement check-in routes**

`apps/api/src/routes/checkins.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { checkin, streak } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export async function checkinRoutes(app: FastifyInstance) {
  // Check in to a class
  app.post('/api/checkins', async (request, reply) => {
    const { classId, studentId } = request.body as { classId: string; studentId: string };

    const [created] = await db.insert(checkin).values({
      classId,
      studentId,
    }).returning();

    // Update streak
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
      if (s.lastCheckinWeek === currentWeek) {
        // Same week, no streak change
      } else {
        // Check if consecutive week
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

- [ ] **Step 4: Register route in app.ts, run tests**

```bash
npx vitest run test/checkins.test.ts
# Expect: PASS
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/checkins.ts apps/api/test/checkins.test.ts apps/api/src/app.ts
git commit -m "feat: add check-in routes with streak tracking"
```

---

## Phase 2: Billing & Membership

### Task 11: Membership Plan Routes

**Files:**
- Create: `apps/api/src/routes/membership-plans.ts`
- Modify: `apps/api/src/app.ts`

Standard CRUD — same pattern as class routes. Instructor creates/updates plans, students can list them.

- [ ] **Step 1: Implement membership plan CRUD**

Endpoints:
- `GET /api/membership-plans?academyId=X` — list active plans
- `POST /api/membership-plans` — create (instructor)
- `PUT /api/membership-plans/:id` — update (instructor)
- `DELETE /api/membership-plans/:id` — deactivate (instructor)

Follow the same pattern as Task 9 (class routes). Use `membershipPlan` schema, filter by `academyId`.

- [ ] **Step 2: Write tests, verify, commit**

```bash
git commit -m "feat: add membership plan CRUD routes"
```

---

### Task 12: Student Management & Membership Assignment

**Files:**
- Create: `apps/api/src/routes/students.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Implement student routes**

Endpoints:
- `GET /api/students?academyId=X` — list students with their active membership
- `GET /api/students/:id` — student profile with membership, payment history, streak
- `POST /api/students/:id/membership` — assign plan to student (instructor)
- `PUT /api/students/:id/membership` — update membership (instructor)

```typescript
// GET /api/students — join user with studentMembership and membershipPlan
app.get('/api/students', async (request) => {
  const { academyId } = request.query as { academyId: string };
  return db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    belt: user.belt,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    planName: membershipPlan.name,
    dueDay: studentMembership.dueDay,
  })
  .from(user)
  .leftJoin(studentMembership, and(eq(studentMembership.studentId, user.id), eq(studentMembership.active, true)))
  .leftJoin(membershipPlan, eq(membershipPlan.id, studentMembership.planId))
  .where(and(eq(user.academyId, academyId), eq(user.role, 'student')));
});
```

- [ ] **Step 2: Write tests, verify, commit**

```bash
git commit -m "feat: add student management and membership assignment routes"
```

---

### Task 13: Payment Tracking Routes

**Files:**
- Create: `apps/api/src/routes/payments.ts`
- Create: `apps/api/test/payments.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write failing test for recording a payment**

```typescript
describe('POST /api/payments', () => {
  it('records a manual payment', async () => {
    // Setup: academy, instructor, student with membership
    const res = await app.inject({
      method: 'POST',
      url: '/api/payments',
      payload: {
        studentId: student.id,
        amount: '250.00',
        paymentDate: '2026-04-05',
        referenceMonth: '2026-04',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().referenceMonth).toBe('2026-04');
  });
});
```

- [ ] **Step 2: Implement payment routes**

Endpoints:
- `POST /api/payments` — record payment (instructor)
- `GET /api/payments?academyId=X` — list all payments
- `GET /api/payments/student/:studentId` — payment history for a student
- `GET /api/payments/overdue?academyId=X` — overdue dashboard

The overdue query is the key logic:
```typescript
// GET /api/payments/overdue
// For each student with an active membership, check if they have a payment
// for the current reference month. If not, and today > due_day, they're overdue.
app.get('/api/payments/overdue', async (request) => {
  const { academyId } = request.query as { academyId: string };
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentDay = now.getDate();

  const studentsWithMembership = await db.select({
    studentId: user.id,
    studentName: user.name,
    email: user.email,
    belt: user.belt,
    planName: membershipPlan.name,
    dueDay: studentMembership.dueDay,
  })
  .from(user)
  .innerJoin(studentMembership, and(eq(studentMembership.studentId, user.id), eq(studentMembership.active, true)))
  .innerJoin(membershipPlan, eq(membershipPlan.id, studentMembership.planId))
  .where(and(eq(user.academyId, academyId), eq(user.role, 'student')));

  const paymentsThisMonth = await db.select()
    .from(payment)
    .where(and(eq(payment.academyId, academyId), eq(payment.referenceMonth, currentMonth)));

  const paidStudentIds = new Set(paymentsThisMonth.map(p => p.studentId));

  return studentsWithMembership
    .filter(s => !paidStudentIds.has(s.studentId) && currentDay > s.dueDay)
    .map(s => ({
      ...s,
      daysOverdue: currentDay - s.dueDay,
      referenceMonth: currentMonth,
    }));
});
```

- [ ] **Step 3: Run tests, verify, commit**

```bash
git commit -m "feat: add payment tracking and overdue dashboard routes"
```

---

## Phase 3: Marketplace

### Task 14: Product Catalog Routes

**Files:**
- Create: `apps/api/src/routes/products.ts`
- Modify: `apps/api/src/app.ts`

Standard CRUD:
- `GET /api/products?academyId=X` — list active products
- `POST /api/products` — create (instructor)
- `PUT /api/products/:id` — update (instructor)
- `DELETE /api/products/:id` — deactivate (instructor)

Same pattern as class routes. Uses `product` schema.

- [ ] **Step 1: Implement, test, commit**

```bash
git commit -m "feat: add product catalog CRUD routes"
```

---

### Task 15: Order Routes

**Files:**
- Create: `apps/api/src/routes/orders.ts`
- Create: `apps/api/test/orders.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Implement order routes**

Endpoints:
- `POST /api/orders` — student places an order request
- `GET /api/orders?academyId=X` — all orders (instructor)
- `GET /api/orders/student/:studentId` — student's orders
- `PUT /api/orders/:id/status` — update order status (instructor: confirmed/delivered/cancelled)

```typescript
app.put('/api/orders/:id/status', { preHandler: [requireInstructor] }, async (request) => {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: string };
  const [updated] = await db.update(order)
    .set({ status, updatedAt: new Date() })
    .where(eq(order.id, id))
    .returning();
  return updated;
});
```

- [ ] **Step 2: Test, verify, commit**

```bash
git commit -m "feat: add order request and tracking routes"
```

---

## Phase 4: Gamification

### Task 16: Season CRUD Routes

**Files:**
- Create: `apps/api/src/routes/seasons.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Implement season routes**

Endpoints:
- `GET /api/seasons?academyId=X` — list all seasons
- `GET /api/seasons/:id` — season details with leaderboard
- `POST /api/seasons` — create season (instructor)
- `PUT /api/seasons/:id` — update season (instructor)

Season creation includes `pointsConfig` (JSON: `{ 1: 10, 2: 7, 3: 5 }`), `startDate`, `endDate`, `prizeDescription`.

- [ ] **Step 2: Test, verify, commit**

```bash
git commit -m "feat: add season CRUD routes"
```

---

### Task 17: Competition Results & Approval Flow

**Files:**
- Create: `apps/api/src/routes/competition-results.ts`
- Create: `apps/api/test/competition-results.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write failing test for result submission and approval**

```typescript
describe('Competition Results', () => {
  it('student submits result, instructor approves, points awarded', async () => {
    // Setup: academy, instructor, student, season with pointsConfig {1:10, 2:7, 3:5}

    // Student submits result (1st place)
    const submitRes = await app.inject({
      method: 'POST',
      url: '/api/competition-results',
      payload: {
        seasonId: season.id,
        studentId: student.id,
        competitionName: 'Copa São Paulo',
        competitionDate: '2026-03-15',
        position: 1,
      },
    });
    expect(submitRes.statusCode).toBe(201);
    expect(submitRes.json().status).toBe('pending');
    expect(submitRes.json().pointsAwarded).toBe(0);

    // Instructor approves
    const approveRes = await app.inject({
      method: 'PUT',
      url: `/api/competition-results/${submitRes.json().id}/approve`,
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe('approved');
    expect(approveRes.json().pointsAwarded).toBe(10); // 1st place = 10pts
  });
});
```

- [ ] **Step 2: Implement competition result routes**

Endpoints:
- `POST /api/competition-results` — submit result (student or instructor)
- `GET /api/competition-results?seasonId=X&status=pending` — list results for review
- `PUT /api/competition-results/:id/approve` — approve and award points (instructor)
- `PUT /api/competition-results/:id/reject` — reject (instructor)

```typescript
// Approve: look up season's pointsConfig, calculate points, update result
app.put('/api/competition-results/:id/approve', { preHandler: [requireInstructor] }, async (request) => {
  const { id } = request.params as { id: string };

  const [result] = await db.select().from(competitionResult).where(eq(competitionResult.id, id));
  if (!result) return reply.status(404).send({ error: 'Not found' });

  const [s] = await db.select().from(season).where(eq(season.id, result.seasonId));
  const points = (s.pointsConfig as Record<number, number>)[result.position] || 0;

  const [updated] = await db.update(competitionResult)
    .set({ status: 'approved', pointsAwarded: points, reviewedBy: request.user.id })
    .where(eq(competitionResult.id, id))
    .returning();

  // Award XP for competition
  await db.insert(xpEntry).values({
    studentId: result.studentId,
    xpAmount: points * 10, // XP multiplier
    sourceType: 'competition',
    sourceId: id,
  });

  return updated;
});
```

- [ ] **Step 3: Run tests, verify, commit**

```bash
git commit -m "feat: add competition results with approval flow and XP award"
```

---

### Task 18: Leaderboard Query

**Files:**
- Modify: `apps/api/src/routes/seasons.ts`
- Create: `apps/api/test/leaderboard.test.ts`

- [ ] **Step 1: Implement leaderboard endpoint**

`GET /api/seasons/:id/leaderboard?category=adults|kids&belt=blue` — returns ranked students.

```typescript
app.get('/api/seasons/:id/leaderboard', async (request) => {
  const { id } = request.params as { id: string };
  const { category, belt } = request.query as { category?: string; belt?: string };

  const KID_AGE_LIMIT = 16;
  const today = new Date();

  // Get all approved results for this season, joined with student info
  const results = await db.select({
    studentId: user.id,
    studentName: user.name,
    belt: user.belt,
    dateOfBirth: user.dateOfBirth,
    totalPoints: sql<number>`SUM(${competitionResult.pointsAwarded})`.as('total_points'),
  })
  .from(competitionResult)
  .innerJoin(user, eq(user.id, competitionResult.studentId))
  .where(and(
    eq(competitionResult.seasonId, id),
    eq(competitionResult.status, 'approved'),
  ))
  .groupBy(user.id, user.name, user.belt, user.dateOfBirth)
  .orderBy(sql`total_points DESC`);

  // Filter by category
  return results.filter(r => {
    const age = Math.floor((today.getTime() - new Date(r.dateOfBirth!).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const isKid = age < KID_AGE_LIMIT;

    if (category === 'kids') return isKid;
    if (category === 'adults' && belt) return !isKid && r.belt === belt;
    return true;
  });
});
```

- [ ] **Step 2: Test, verify, commit**

```bash
git commit -m "feat: add leaderboard endpoint with belt/age category filtering"
```

---

### Task 19: Gamification Routes (Badges, XP, Streaks)

**Files:**
- Create: `apps/api/src/routes/gamification.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Implement gamification endpoints**

Endpoints:
- `GET /api/gamification/profile/:studentId` — returns XP total, streak, badges
- `GET /api/gamification/badges?academyId=X` — list badge definitions
- `POST /api/gamification/badges` — create badge definition (instructor)
- `POST /api/gamification/badges/:badgeId/award/:studentId` — manually award badge (instructor)

```typescript
app.get('/api/gamification/profile/:studentId', async (request) => {
  const { studentId } = request.params as { studentId: string };

  const [studentStreak] = await db.select().from(streak).where(eq(streak.studentId, studentId));
  const [xpTotal] = await db.select({ total: sql<number>`COALESCE(SUM(${xpEntry.xpAmount}), 0)` })
    .from(xpEntry).where(eq(xpEntry.studentId, studentId));
  const badges = await db.select({
    name: badgeDefinition.name,
    description: badgeDefinition.description,
    icon: badgeDefinition.icon,
    earnedAt: studentBadge.earnedAt,
  })
  .from(studentBadge)
  .innerJoin(badgeDefinition, eq(badgeDefinition.id, studentBadge.badgeDefinitionId))
  .where(eq(studentBadge.studentId, studentId));

  return {
    xp: xpTotal.total,
    streak: studentStreak || { currentStreak: 0, longestStreak: 0 },
    badges,
  };
});
```

- [ ] **Step 2: Test, verify, commit**

```bash
git commit -m "feat: add gamification profile, badge, and XP routes"
```

---

## Phase 5: Tournaments

### Task 20: Tournament Routes

**Files:**
- Create: `apps/api/src/routes/tournaments.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Implement tournament routes**

Endpoints:
- `GET /api/tournaments?academyId=X` — list tournaments
- `POST /api/tournaments` — create (instructor)
- `POST /api/tournaments/:id/signup` — student signs up
- `GET /api/tournaments/:id/roster` — view signed-up students

Standard CRUD + signup flow. Uses `tournament` and `tournamentSignup` schemas.

- [ ] **Step 2: Test, verify, commit**

```bash
git commit -m "feat: add tournament listing and signup routes"
```

---

## Phase 6: Frontend Pages

> All pages follow the same pattern: fetch data via `api()` helper, render with React, use `useTranslation()` for all strings.

### Task 21: Login & Signup Pages

**Files:**
- Create: `apps/web/src/pages/login.tsx`
- Create: `apps/web/src/pages/signup.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Implement login page**

```typescript
import { useState } from 'react';
import { signIn } from '../lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await signIn.email({ email, password });
    if (error) setError(error.message);
    else navigate('/');
  }

  return (
    <div>
      <h1>{t('auth.login')}</h1>
      <form onSubmit={handleSubmit}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.email')} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.password')} />
        {error && <p>{error}</p>}
        <button type="submit">{t('auth.login')}</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Implement signup page (similar pattern), wire into App.tsx, commit**

```bash
git commit -m "feat: add login and signup pages"
```

---

### Task 22: App Layout with Sidebar

**Files:**
- Create: `apps/web/src/components/layout/sidebar.tsx`
- Create: `apps/web/src/components/layout/header.tsx`
- Create: `apps/web/src/components/layout/app-layout.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create layout with role-based sidebar**

```typescript
// sidebar.tsx
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSession } from '../../lib/auth-client';

export function Sidebar() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const isInstructor = session?.user?.role === 'instructor';

  const navItems = [
    { to: '/', label: t('nav.dashboard'), show: true },
    { to: '/classes', label: t('nav.classes'), show: true },
    { to: '/students', label: t('nav.students'), show: isInstructor },
    { to: '/billing', label: t('nav.billing'), show: isInstructor },
    { to: '/marketplace', label: t('nav.marketplace'), show: true },
    { to: '/gamification', label: t('nav.gamification'), show: true },
    { to: '/tournaments', label: t('nav.tournaments'), show: true },
  ];

  return (
    <nav>
      {navItems.filter(i => i.show).map(item => (
        <Link key={item.to} to={item.to}>{item.label}</Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create header with language switcher and logout**

```typescript
// header.tsx
import { useTranslation } from 'react-i18next';
import { signOut } from '../../lib/auth-client';

export function Header() {
  const { t, i18n } = useTranslation();

  return (
    <header>
      <h1>{t('app.name')}</h1>
      <select value={i18n.language} onChange={e => i18n.changeLanguage(e.target.value)}>
        <option value="pt-BR">Português</option>
        <option value="en">English</option>
      </select>
      <button onClick={() => signOut()}>{t('auth.logout')}</button>
    </header>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add app layout with sidebar and language switcher"
```

---

### Task 23: Class Schedule & Check-in Pages

**Files:**
- Create: `apps/web/src/pages/classes/index.tsx`
- Create: `apps/web/src/pages/classes/checkin.tsx`

- [ ] **Step 1: Class list page** — shows weekly schedule grid. Instructor sees create/edit buttons. Students see check-in button.

- [ ] **Step 2: Check-in page** — student selects active class, confirms check-in. Shows their attendance history.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add class schedule and check-in pages"
```

---

### Task 24: Student Registry & Billing Pages

**Files:**
- Create: `apps/web/src/pages/students/index.tsx`
- Create: `apps/web/src/pages/students/[id].tsx`
- Create: `apps/web/src/pages/billing/index.tsx`
- Create: `apps/web/src/pages/billing/plans.tsx`
- Create: `apps/web/src/pages/billing/payments.tsx`

- [ ] **Step 1: Student list page** — table with name, belt, plan, payment status. Search/filter.

- [ ] **Step 2: Student detail page** — profile, membership, payment history, gamification stats.

- [ ] **Step 3: Overdue dashboard** — red/yellow cards showing who hasn't paid. Days overdue count.

- [ ] **Step 4: Membership plans page** — CRUD for plans (instructor). List view for students.

- [ ] **Step 5: Payment recording page** — instructor selects student, enters amount, date, reference month.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add student registry and billing pages"
```

---

### Task 25: Marketplace Pages

**Files:**
- Create: `apps/web/src/pages/marketplace/index.tsx`
- Create: `apps/web/src/pages/marketplace/orders.tsx`

- [ ] **Step 1: Product catalog** — grid of products with photo, price, stock. Students see "Request" button. Instructor sees create/edit.

- [ ] **Step 2: Order management** — instructor sees all orders, updates status (confirmed/delivered/cancelled). Student sees their own orders.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add marketplace and order management pages"
```

---

### Task 26: Gamification Pages

**Files:**
- Create: `apps/web/src/pages/gamification/seasons.tsx`
- Create: `apps/web/src/pages/gamification/leaderboard.tsx`
- Create: `apps/web/src/pages/gamification/results.tsx`
- Create: `apps/web/src/pages/gamification/profile.tsx`

- [ ] **Step 1: Season management** — instructor creates/edits seasons with points config and prizes.

- [ ] **Step 2: Leaderboard** — tabs for Kids / Adults. Adults sub-filtered by belt. Shows rank, name, points.

- [ ] **Step 3: Results approval** — instructor sees pending submissions, approves/rejects with one click.

- [ ] **Step 4: Student gamification profile** — XP bar, current streak fire icon, longest streak, badge collection, belt journey timeline.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add gamification pages — seasons, leaderboard, results, profile"
```

---

### Task 27: Tournament Pages

**Files:**
- Create: `apps/web/src/pages/tournaments/index.tsx`

- [ ] **Step 1: Tournament list** — upcoming tournaments with date, location, federation. Students sign up. Instructor sees roster.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add tournament listing and signup page"
```

---

## i18n Completion Checklist

After all pages are built, do a final i18n pass:

- [ ] All user-facing strings use `t()` — no hardcoded Portuguese or English in components
- [ ] Add missing keys to both `pt-BR.json` and `en.json` for every page (classes, billing, marketplace, gamification, tournaments)
- [ ] Test full app in both languages by switching in the header

---

## Final Integration Checklist

- [ ] All routes registered in `apps/api/src/app.ts`
- [ ] All pages wired in `apps/web/src/App.tsx` router
- [ ] Auth middleware on all protected routes
- [ ] Tenant middleware scoping queries to `academyId`
- [ ] Role checks: instructor-only routes return 403 for students
- [ ] Seed script creates a usable demo state
- [ ] `npm run dev` starts both API and web concurrently
- [ ] Test in pt-BR (default) and en
