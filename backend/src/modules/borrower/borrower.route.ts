import { FastifyInstance } from 'fastify';
import { BorrowerController } from './borrower.controller';
import { authorize } from '../../middleware/auth.middleware';

const READ_ROLES = ['ADMIN', 'LOAN_OFFICER', 'CREDIT_MANAGER'] as const;
const WRITE_ROLES = ['ADMIN', 'LOAN_OFFICER'] as const;

export async function borrowerRoutes(fastify: FastifyInstance) {
  // POST /api/v1/borrowers - Create borrower
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate, authorize([...WRITE_ROLES])],
      schema: {
        body: {
          type: 'object',
          required: ['fullName', 'nationalId', 'phone', 'email', 'address', 'occupation', 'guarantorName', 'guarantorPhone'],
          properties: {
            fullName: { type: 'string', minLength: 2 },
            nationalId: { type: 'string', minLength: 5 },
            phone: { type: 'string', minLength: 7 },
            email: { type: 'string', format: 'email' },
            address: { type: 'string', minLength: 2 },
            occupation: { type: 'string', minLength: 2 },
            guarantorName: { type: 'string', minLength: 2 },
            guarantorPhone: { type: 'string', minLength: 7 },
            photo: { type: 'string' },
          },
        },
      },
    },
    BorrowerController.create as any
  );

  // GET /api/v1/borrowers - List all borrowers (with optional search)
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate, authorize([...READ_ROLES])],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
          },
        },
      },
    },
    BorrowerController.list as any
  );

  // GET /api/v1/borrowers/:id - Get a single borrower
  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize([...READ_ROLES])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    BorrowerController.getOne as any
  );

  // PATCH /api/v1/borrowers/:id - Update borrower
  fastify.patch(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize([...WRITE_ROLES])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          minProperties: 1,
          properties: {
            fullName: { type: 'string', minLength: 2 },
            phone: { type: 'string', minLength: 7 },
            email: { type: 'string', format: 'email' },
            address: { type: 'string', minLength: 2 },
            occupation: { type: 'string', minLength: 2 },
            guarantorName: { type: 'string', minLength: 2 },
            guarantorPhone: { type: 'string', minLength: 7 },
            photo: { type: 'string' },
          },
        },
      },
    },
    BorrowerController.update as any
  );

  // DELETE /api/v1/borrowers/:id - Delete borrower
  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate, authorize([...WRITE_ROLES])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    BorrowerController.remove as any
  );
}
