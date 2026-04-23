import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { checkin, streak, bjjClass, academy, checkinToken, user } from '../db/schema/index.js';
import { eq, and, gte, lte, ne, desc } from 'drizzle-orm';
import { requireAuth, requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { haversineDistance } from '../utils/haversine.js';
import { isClassActiveNow } from '../utils/time-window.js';
import { dayInTz, isoDateInTz, DEFAULT_ACADEMY_TIMEZONE } from '../utils/timezone.js';

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function updateStreak(studentId: string, now: Date): Promise<void> {
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
      const lastWeekDate = new Date(now);
      lastWeekDate.setDate(lastWeekDate.getDate() - 7);
      const lastWeek = getISOWeek(lastWeekDate);

      const newStreak = s.lastCheckinWeek === lastWeek ? s.currentStreak + 1 : 1;
      const newLongest = Math.max(s.longestStreak, newStreak);

      await db
        .update(streak)
        .set({ currentStreak: newStreak, longestStreak: newLongest, lastCheckinWeek: currentWeek, updatedAt: now })
        .where(eq(streak.studentId, studentId));
    }
  }
}

export async function checkinRoutes(app: FastifyInstance) {
  // POST /api/checkins — validated checkin pipeline
  app.post('/api/checkins', { preHandler: requireAuth }, async (request, reply) => {
    const studentId = request.user.id;
    const { classId, source, latitude, longitude, token } = request.body as {
      classId: string;
      source: 'button' | 'qr';
      latitude?: number;
      longitude?: number;
      token?: string;
    };

    // 1. Class exists and active=true
    const [cls] = await db.select().from(bjjClass).where(eq(bjjClass.id, classId)).limit(1);
    if (!cls || !cls.active) {
      return reply.status(400).send({ error: 'CLASS_NOT_ACTIVE' });
    }

    // 2. Time window check
    if (!isClassActiveNow(cls)) {
      return reply.status(400).send({ error: 'OUTSIDE_TIME_WINDOW' });
    }

    // 3. No duplicate checkin today
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const duplicates = await db
      .select()
      .from(checkin)
      .where(
        and(
          eq(checkin.classId, classId),
          eq(checkin.studentId, studentId),
          gte(checkin.checkedInAt, startOfDay),
          lte(checkin.checkedInAt, endOfDay),
        ),
      )
      .limit(1);

    if (duplicates.length > 0) {
      return reply.status(400).send({ error: 'CHECKIN_DUPLICATE' });
    }

    // 4. No overlap — same student, same day, same startTime in a different class
    const overlapping = await db
      .select({ checkinId: checkin.id })
      .from(checkin)
      .innerJoin(bjjClass, eq(checkin.classId, bjjClass.id))
      .where(
        and(
          eq(checkin.studentId, studentId),
          gte(checkin.checkedInAt, startOfDay),
          lte(checkin.checkedInAt, endOfDay),
          eq(bjjClass.startTime, cls.startTime),
          ne(checkin.classId, classId),
        ),
      )
      .limit(1);

    if (overlapping.length > 0) {
      return reply.status(400).send({ error: 'OVERLAPPING_CLASS' });
    }

    // 5. QR source: validate token
    if (source === 'qr') {
      if (!token) {
        return reply.status(400).send({ error: 'INVALID_TOKEN' });
      }
      const [tokenRecord] = await db
        .select()
        .from(checkinToken)
        .where(eq(checkinToken.token, token))
        .limit(1);

      if (!tokenRecord || tokenRecord.classId !== classId || tokenRecord.expiresAt < now) {
        return reply.status(400).send({ error: 'INVALID_TOKEN' });
      }
    }

    // 6. Button source: proximity check
    if (source === 'button') {
      const [acad] = await db
        .select()
        .from(academy)
        .where(eq(academy.id, cls.academyId))
        .limit(1);

      if (!acad?.latitude || !acad?.longitude) {
        return reply.status(400).send({ error: 'LOCATION_NOT_SET' });
      }

      if (latitude == null || longitude == null) {
        return reply.status(400).send({ error: 'LOCATION_NOT_SET' });
      }

      const distance = haversineDistance(
        Number(acad.latitude),
        Number(acad.longitude),
        Number(latitude),
        Number(longitude),
      );

      if (distance > 250) {
        return reply.status(400).send({ error: 'TOO_FAR' });
      }
    }

    // All checks passed — insert checkin
    const [created] = await db
      .insert(checkin)
      .values({
        classId,
        studentId,
        source: source ?? 'button',
        latitude: latitude != null ? String(latitude) : null,
        longitude: longitude != null ? String(longitude) : null,
      })
      .returning();

    await updateStreak(studentId, now);

    return reply.status(201).send(created);
  });

  // GET /api/checkins/tokens — instructor: return tokens for active classes
  app.get(
    '/api/checkins/tokens',
    { preHandler: [requireInstructor, injectAcademyId] },
    async (request, reply) => {
      const academyId = request.academyId;
      const now = new Date();

      // Find all active classes for this academy
      const classes = await db
        .select()
        .from(bjjClass)
        .where(and(eq(bjjClass.academyId, academyId), eq(bjjClass.active, true)));

      // Filter to currently active classes
      const activeClasses = classes.filter((cls) => isClassActiveNow(cls, now));

      const results = [];

      for (const cls of activeClasses) {
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

        // Check for an existing valid token
        const [existing] = await db
          .select()
          .from(checkinToken)
          .where(
            and(
              eq(checkinToken.classId, cls.id),
              gte(checkinToken.expiresAt, now),
            ),
          )
          .limit(1);

        if (existing) {
          results.push({
            classId: cls.id,
            className: cls.name,
            classType: cls.type,
            startTime: cls.startTime,
            endTime: cls.endTime,
            token: existing.token,
            expiresAt: existing.expiresAt,
          });
        } else {
          const newToken = crypto.randomUUID();
          const [created] = await db
            .insert(checkinToken)
            .values({
              classId: cls.id,
              token: newToken,
              expiresAt,
            })
            .returning();

          results.push({
            classId: cls.id,
            className: cls.name,
            classType: cls.type,
            startTime: cls.startTime,
            endTime: cls.endTime,
            token: created.token,
            expiresAt: created.expiresAt,
          });
        }
      }

      return reply.send(results);
    },
  );

  // Get attendance for a class
  app.get('/api/checkins/class/:classId', async (request) => {
    const { classId } = request.params as { classId: string };
    return db.select().from(checkin).where(eq(checkin.classId, classId));
  });

  // Get attendance history for a student (TZ-aware, enriched with class info)
  app.get('/api/checkins/student/:studentId', { preHandler: requireAuth }, async (request) => {
    const { studentId } = request.params as { studentId: string };

    // Resolve the student's academy timezone (fall back to default)
    let tz = DEFAULT_ACADEMY_TIMEZONE;
    const [studentRow] = await db
      .select({ academyId: user.academyId })
      .from(user)
      .where(eq(user.id, studentId))
      .limit(1);
    if (studentRow?.academyId) {
      const [acad] = await db
        .select({ tz: academy.timezone })
        .from(academy)
        .where(eq(academy.id, studentRow.academyId))
        .limit(1);
      if (acad?.tz) tz = acad.tz;
    }

    const rows = await db
      .select({
        id: checkin.id,
        checkedInAt: checkin.checkedInAt,
        date: dayInTz(checkin.checkedInAt, tz).as('date'),
        classId: bjjClass.id,
        className: bjjClass.name,
        classType: bjjClass.type,
      })
      .from(checkin)
      .leftJoin(bjjClass, eq(bjjClass.id, checkin.classId))
      .where(eq(checkin.studentId, studentId))
      .orderBy(desc(checkin.checkedInAt));

    return rows.map((r) => ({
      id: r.id,
      checkedInAt: r.checkedInAt,
      date: r.date instanceof Date ? isoDateInTz(r.date, tz) : String(r.date),
      class: r.classId
        ? { id: r.classId, name: r.className, type: r.classType }
        : null,
    }));
  });
}
