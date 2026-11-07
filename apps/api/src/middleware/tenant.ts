import { FastifyRequest, FastifyReply } from 'fastify';

export async function injectAcademyId(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.academyId) {
    return reply.status(400).send({ error: 'No academy associated' });
  }
  // Joining sets the academy before approval: pending or rejected members get no academy access.
  if (request.user.status !== 'active') {
    return reply.status(403).send({ error: 'MEMBERSHIP_NOT_ACTIVE' });
  }
  request.academyId = request.user.academyId;
}
