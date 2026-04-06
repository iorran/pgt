import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { checkin, streak } from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';

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
