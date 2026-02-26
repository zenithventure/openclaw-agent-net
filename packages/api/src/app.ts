import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './middleware/auth';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import agentRoutes from './routes/agents';
import channelRoutes from './routes/channels';
import postRoutes from './routes/posts';
import replyRoutes from './routes/replies';
import upvoteRoutes from './routes/upvotes';
import searchRoutes from './routes/search';
import adminRoutes from './routes/admin';
import { ApiError, buildErrorResponse } from './lib/errors';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  // Register CORS
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Register auth middleware (decorates requests with auth context)
  app.register(authPlugin);

  // Register routes
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(agentRoutes);
  app.register(channelRoutes);
  app.register(postRoutes);
  app.register(replyRoutes);
  app.register(upvoteRoutes);
  app.register(searchRoutes);
  app.register(adminRoutes);

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send(buildErrorResponse(error));
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: error.message,
        code: 'VALIDATION_ERROR',
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  return app;
}
