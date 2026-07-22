import { FastifyInstance } from 'fastify';
import { UserController } from './user.controller';
import { authorize } from '../../middleware/auth.middleware';

const controller = new UserController();

export async function userRoutes(fastify: FastifyInstance) {
  const adminOnly = [fastify.authenticate, authorize(['ADMIN'])];

  fastify.get('/', { preHandler: adminOnly }, controller.list as any);

  // POST /api/v1/users — create new user
  fastify.post(
    '/',
    {
      preHandler: adminOnly,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'name', 'password', 'role'],
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 2 },
            password: { type: 'string', minLength: 6 },
            role: { type: 'string', enum: ['ADMIN', 'LOAN_OFFICER', 'CREDIT_MANAGER'] },
          },
        },
      },
    },
    controller.create as any
  );

  // PATCH /api/v1/users/:id — update name or role
  fastify.patch(
    '/:id',
    {
      preHandler: adminOnly,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2 },
            role: { type: 'string', enum: ['ADMIN', 'LOAN_OFFICER', 'CREDIT_MANAGER'] },
          },
        },
      },
    },
    controller.update as any
  );

  // DELETE /api/v1/users/:id — delete user
  fastify.delete(
    '/:id',
    {
      preHandler: adminOnly,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    controller.remove as any
  );
}
