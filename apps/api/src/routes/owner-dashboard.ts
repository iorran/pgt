import { FastifyInstance } from 'fastify';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { requireOwner } from '../middleware/require-owner.js';
import { db } from '../db/client.js';
import { bjjClass } from '../db/schema/class.js';
import { checkin } from '../db/schema/checkin.js';
import {
  weekBoundsInTz,
  monthBoundsInTz,
  startOfDayInTz,
  isoDateInTz,
  dayInTz,
} from '../utils/timezone.js';

function periodBounds(period: 'day' | 'week' | 'month', fromIso: string, tz: string) {
  if (period === 'day') {
    const from = startOfDayInTz(fromIso, tz);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    return { from, to, fromIso, toIso: isoDateInTz(to, tz) };
  }
  if (period === 'week') {
    const { fromUtc, toUtc } = weekBoundsInTz(fromIso, tz);
    return { from: fromUtc, to: toUtc, fromIso: isoDateInTz(fromUtc, tz), toIso: isoDateInTz(toUtc, tz) };
  }
  const { fromUtc, toUtc } = monthBoundsInTz(fromIso, tz);
  return { from: fromUtc, to: toUtc, fromIso: isoDateInTz(fromUtc, tz), toIso: isoDateInTz(toUtc, tz) };
}

export async function ownerDashboardRoutes(app: FastifyInstance) {
  app.get('/api/owner/students', { preHandler: requireOwner }, async () => {
    return { students: [] };
  });

  app.get('/api/owner/classes/aderencia', { preHandler: requireOwner }, async (request) => {
    const q = request.query as { period?: string; from?: string };
    const period: 'day' | 'week' | 'month' =
      q.period === 'day' || q.period === 'month' ? q.period : 'week';
    const tz = request.academy!.timezone;
    const academyId = request.academy!.id;
    const fromIso = q.from ?? isoDateInTz(new Date(), tz);
    const { from, to, fromIso: fIso, toIso: tIso } = periodBounds(period, fromIso, tz);

    const periodRows = await db
      .select({
        classId: bjjClass.id,
        name: bjjClass.name,
        type: bjjClass.type,
        totalCheckins: sql<number>`count(${checkin.id})::int`,
        uniqueStudents: sql<number>`count(distinct ${checkin.studentId})::int`,
        occurrences: sql<number>`count(distinct ${dayInTz(checkin.checkedInAt, tz)})::int`,
      })
      .from(bjjClass)
      .leftJoin(
        checkin,
        and(
          eq(checkin.classId, bjjClass.id),
          gte(checkin.checkedInAt, from),
          lt(checkin.checkedInAt, to),
        ),
      )
      .where(and(eq(bjjClass.academyId, academyId), eq(bjjClass.active, true)))
      .groupBy(bjjClass.id, bjjClass.name, bjjClass.type);

    // Baseline: last 4 occurrence dates per class, strictly before `from`.
    // Inline the timezone as a SQL literal so Postgres recognizes the SELECT
    // and GROUP BY expressions as identical (parameterized placeholders differ
    // at each site and trigger 42803 "must appear in GROUP BY").
    const tzLit = sql.raw(`'${tz.replace(/'/g, "''")}'`);
    const baselineMap = new Map<string, number | null>();
    for (const row of periodRows) {
      const prior = await db.execute(sql`
        SELECT
          ((${checkin.checkedInAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLit})::date)::text AS day,
          count(*)::int AS count
        FROM ${checkin}
        WHERE ${checkin.classId} = ${row.classId}
          AND ${checkin.checkedInAt} < ${from.toISOString()}
        GROUP BY ((${checkin.checkedInAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLit})::date)
        ORDER BY ((${checkin.checkedInAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLit})::date) DESC
        LIMIT 4
      `);
      const priorRows = prior as unknown as Array<{ day: string; count: number }>;
      if (priorRows.length < 3) {
        baselineMap.set(row.classId, null);
        continue;
      }
      const avg = priorRows.reduce((s, r) => s + Number(r.count), 0) / priorRows.length;
      baselineMap.set(row.classId, avg === 0 ? null : avg);
    }

    const classes = periodRows
      .map((r) => {
        const totalCheckins = Number(r.totalCheckins);
        const occurrences = Number(r.occurrences);
        const uniqueStudents = Number(r.uniqueStudents);
        const avgPerOccurrence = occurrences > 0 ? totalCheckins / occurrences : 0;
        const baseline = baselineMap.get(r.classId);
        const trend = baseline == null ? null : avgPerOccurrence / baseline;
        return {
          classId: r.classId,
          name: r.name,
          type: r.type,
          totalCheckins,
          uniqueStudents,
          occurrences,
          avgPerOccurrence,
          trend,
        };
      })
      .sort((a, b) => b.totalCheckins - a.totalCheckins);

    return { period, from: fIso, to: tIso, classes };
  });

  app.get(
    '/api/owner/classes/:classId/occurrences',
    { preHandler: requireOwner },
    async (request, reply) => {
      const { classId } = request.params as { classId: string };
      const q = request.query as { from?: string; to?: string };
      if (!q.from || !q.to) {
        return reply.status(400).send({ error: 'from and to required' });
      }
      const tz = request.academy!.timezone;
      const from = startOfDayInTz(q.from, tz);
      const to = startOfDayInTz(q.to, tz);

      // Scope to the academy
      const [cls] = await db
        .select({ id: bjjClass.id })
        .from(bjjClass)
        .where(and(eq(bjjClass.id, classId), eq(bjjClass.academyId, request.academy!.id)))
        .limit(1);
      if (!cls) return reply.status(404).send({ error: 'Class not found' });

      // Inline timezone as SQL literal to avoid 42803 (Drizzle emits distinct
      // placeholder numbers for `dayInTz(col, tz)` at SELECT/GROUP BY/ORDER BY,
      // making Postgres treat the expressions as non-identical).
      const tzLit = sql.raw(`'${tz.replace(/'/g, "''")}'`); // SAFE: server-controlled, single-quote-escaped
      const dayBucket = sql`((${checkin.checkedInAt} AT TIME ZONE 'UTC' AT TIME ZONE ${tzLit})::date)`;

      const rows = await db
        .select({
          date: sql<string>`${dayBucket}::text`.as('date'),
          checkins: sql<number>`count(*)::int`,
          uniqueStudents: sql<number>`count(distinct ${checkin.studentId})::int`,
        })
        .from(checkin)
        .where(
          and(
            eq(checkin.classId, classId),
            gte(checkin.checkedInAt, from),
            lt(checkin.checkedInAt, to),
          ),
        )
        .groupBy(dayBucket)
        .orderBy(dayBucket);

      return {
        classId,
        occurrences: rows.map((r) => ({
          date: String(r.date),
          checkins: Number(r.checkins),
          uniqueStudents: Number(r.uniqueStudents),
        })),
      };
    },
  );
}
