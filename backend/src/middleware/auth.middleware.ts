import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@prisma/client';

export function authorize(allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { role: Role } | undefined;

    if (!user || !user.role || !allowedRoles.includes(user.role)) {
      return reply.code(403).send({
        error: {
          message: 'Forbidden: You do not have permission to access this resource',
          code: 'FORBIDDEN',
        },
      });
    }
  };
}
