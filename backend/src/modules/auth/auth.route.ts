import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';

export async function authRoutes(fastify: FastifyInstance) {
  const controller = new AuthController();

  // Login route
  fastify.post(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'passwordPlain'],
          properties: {
            email: { type: 'string', format: 'email' },
            passwordPlain: { type: 'string', minLength: 6 },
          },
        },
      },
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    controller.login
  );

  // Logout route
  fastify.post(
    '/logout',
    {
      preHandler: [fastify.authenticate],
    },
    controller.logout
  );

  // Change Password route
  fastify.post(
    '/change-password',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['oldPasswordPlain', 'newPasswordPlain'],
          properties: {
            oldPasswordPlain: { type: 'string', minLength: 6 },
            newPasswordPlain: { type: 'string', minLength: 6 },
          },
        },
      },
    },
    controller.changePassword as any
  );

  // Update Profile route (e.g. update own email/name)
  fastify.patch(
    '/profile',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 2 },
          },
        },
      },
    },
    controller.updateProfile as any
  );
}
