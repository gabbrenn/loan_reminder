import { FastifyInstance } from 'fastify';
import { authorize } from '../../middleware/auth.middleware';
import { getSettings, updateSettings } from './settings.controller';

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/v1/settings',
    { preHandler: [fastify.authenticate] },
    getSettings,
  );

  fastify.patch(
    '/api/v1/settings',
    {
      preHandler: [fastify.authenticate, authorize(['ADMIN'])],
      schema: {
        body: {
          type: 'object',
          properties: {
            reminderDaysBefore1: { type: 'integer', minimum: 1 },
            reminderDaysBefore2: { type: 'integer', minimum: 1 },
            reminderDaysBefore3: { type: 'integer', minimum: 1 },
            smsEnabled: { type: 'boolean' },
            emailEnabled: { type: 'boolean' },
          },
          additionalProperties: false,
        },
      },
    },
    updateSettings,
  );
}
