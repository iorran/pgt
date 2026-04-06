import { FastifyRequest, FastifyReply } from 'fastify';

export async function injectAcademyId(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.academyId) {
    return reply.status(400).send({ error: 'No academy associated' });
  }
  request.academyId = request.user.academyId;
}
