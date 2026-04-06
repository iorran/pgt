import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { user, studentMembership, membershipPlan } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';

export async function studentRoutes(app: FastifyInstance) {
  // List students with their active membership plan name
  app.get('/api/students', async (request) => {
    const { academyId } = request.query as { academyId: string };
    const rows = await db
      .select({
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
      .leftJoin(studentMembership, and(
        eq(studentMembership.studentId, user.id),
        eq(studentMembership.active, true),
      ))
      .leftJoin(membershipPlan, eq(membershipPlan.id, studentMembership.planId))
      .where(and(eq(user.role, 'student'), eq(user.academyId, academyId)));
    return rows;
  });

  // Single student profile with membership info
  app.get('/api/students/:id', async (request) => {
    const { id } = request.params as { id: string };
    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        belt: user.belt,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        image: user.image,
        createdAt: user.createdAt,
        planName: membershipPlan.name,
        planId: studentMembership.planId,
        dueDay: studentMembership.dueDay,
        membershipStartDate: studentMembership.startDate,
      })
      .from(user)
      .leftJoin(studentMembership, and(
        eq(studentMembership.studentId, user.id),
        eq(studentMembership.active, true),
      ))
      .leftJoin(membershipPlan, eq(membershipPlan.id, studentMembership.planId))
      .where(eq(user.id, id));
    return row;
  });

  // Assign a plan to a student (instructor only)
  app.post('/api/students/:id/membership', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { planId: string; startDate: string; dueDay: number };
    const [created] = await db.insert(studentMembership).values({
      studentId: id,
      planId: body.planId,
      startDate: body.startDate,
      dueDay: body.dueDay,
    }).returning();
    return reply.status(201).send(created);
  });

  // Update active membership (instructor only)
  app.put('/api/students/:id/membership', { preHandler: [requireInstructor, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const [updated] = await db.update(studentMembership)
      .set(body)
      .where(and(eq(studentMembership.studentId, id), eq(studentMembership.active, true)))
      .returning();
    return updated;
  });
}
