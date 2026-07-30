import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyCors from '@fastify/cors';

import { authRoutes } from './modules/auth/auth.route';
import { borrowerRoutes } from './modules/borrower/borrower.route';
import { loanRoutes } from './modules/loan/loan.route';
import { repaymentRoutes } from './modules/repayment/repayment.route';
import { reminderRoutes } from './modules/reminder/reminder.route';
import { initReminderCron } from './modules/reminder/reminder.cron';
import { dashboardRoutes } from './modules/dashboard/dashboard.route';
import { notificationRoutes } from './modules/notification/notification.route';
import { userRoutes } from './modules/user/user.route';
import { settingsRoutes } from './modules/settings/settings.route';
import { auditRoutes } from './modules/audit/audit.route';
import { messageRoutes } from './modules/message/message.route';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Register CORS plugin
const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
fastify.register(fastifyCors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!frontendUrl) return cb(null, true);
    const allowedOrigins = frontendUrl.split(',').map((u) => u.trim());
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return cb(null, true);
    }
    return cb(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  strictPreflight: false,
});

// Guarantee CORS headers on every single incoming response (including preflight and validation errors)
fastify.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;
  if (origin) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  }
  if (request.method === 'OPTIONS') {
    return reply.code(204).send();
  }
});




// Custom 404 handler ensuring CORS headers are included on 404 responses
fastify.setNotFoundHandler((request, reply) => {
  const origin = request.headers.origin;
  if (origin) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
  }
  return reply.code(404).send({
    error: {
      message: `Route ${request.method}:${request.url} not found`,
      code: 'NOT_FOUND',
    },
  });
});

// Error handling matching NFR: { error: { message, code } }
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  const origin = request.headers.origin;
  if (origin) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
  }
  
  const err = error as any;
  if (err.statusCode) {
    return reply.code(err.statusCode).send({
      error: {
        message: err.message,
        code: err.code || 'BAD_REQUEST',
      },
    });
  }

  return reply.code(500).send({
    error: {
      message: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
    },
  });
});


// Register JWT plugin
const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-development';
fastify.register(fastifyJwt, {
  secret: jwtSecret,
});

// Register Rate Limit plugin
fastify.register(fastifyRateLimit, {
  global: false, // Only apply to routes that explicitly configure rate limit (like login)
});

// Decorate fastify with authenticate method
fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({
      error: {
        message: 'Unauthorized: Invalid or missing token',
        code: 'UNAUTHORIZED',
      },
    });
  }
});

// Extend typings for authenticate decorator
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// Register Auth Routes
fastify.register(authRoutes, { prefix: '/api/v1/auth' });

// Register Borrower Routes
fastify.register(borrowerRoutes, { prefix: '/api/v1/borrowers' });

// Register Loan Routes
fastify.register(loanRoutes, { prefix: '/api/v1/loans' });

// Register Loan Messaging Routes
fastify.register(messageRoutes, { prefix: '/api/v1/loans' });

// Register Repayment Routes
fastify.register(repaymentRoutes, { prefix: '/api/v1/repayments' });


// Register Reminder Routes
fastify.register(reminderRoutes, { prefix: '/api/v1/reminders' });

// Register Dashboard Routes
fastify.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });

// Register Notification Log Routes
fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });

// Register User Routes
fastify.register(userRoutes, { prefix: '/api/v1/users' });

// Register Settings Routes
fastify.register(settingsRoutes);

// Register Audit Routes
fastify.register(auditRoutes);

// Default route
fastify.get('/', async () => {
  return { status: 'healthy', version: 'v1.0.0' };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server is running on port 3000');
    // Start node-cron reminder scheduler
    initReminderCron();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
