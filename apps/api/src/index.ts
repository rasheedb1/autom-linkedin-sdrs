import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import supabasePlugin from './plugins/supabase.js';

// Route imports
import { healthRoutes } from './routes/health.js';
import { unipileConnectRoutes } from './routes/unipile/connect.js';
import { unipileWebhookRoutes } from './routes/unipile/webhook.js';
import { linkedinMessageRoutes } from './routes/linkedin/message.js';
import { linkedinPostsRoutes } from './routes/linkedin/posts.js';
import { linkedinSalesnavRoutes } from './routes/linkedin/salesnav.js';
import { leadsRoutes } from './routes/leads/index.js';
import { cadencesRoutes } from './routes/cadences/index.js';
import { executionRoutes } from './routes/execution/index.js';
import { activityRoutes } from './routes/activity/index.js';
import { templatesRoutes } from './routes/templates/index.js';

/**
 * Build and configure the Fastify application
 */
async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Register Supabase plugin
  await fastify.register(supabasePlugin);

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(unipileConnectRoutes);
  await fastify.register(unipileWebhookRoutes);
  await fastify.register(linkedinMessageRoutes);
  await fastify.register(linkedinPostsRoutes);
  await fastify.register(linkedinSalesnavRoutes);
  await fastify.register(leadsRoutes, { prefix: '/api/leads' });
  await fastify.register(cadencesRoutes, { prefix: '/api/cadences' });
  await fastify.register(executionRoutes, { prefix: '/api/execution' });
  await fastify.register(activityRoutes, { prefix: '/api/activity' });
  await fastify.register(templatesRoutes, { prefix: '/api/templates' });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error({ error, url: request.url }, 'Unhandled error');

    reply.status(error.statusCode || 500).send({
      success: false,
      status: 'error',
      error: error.message || 'Internal server error',
      error_code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      provider: 'cadence-automator',
    });
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      status: 'error',
      error: 'Not found',
      error_code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
      provider: 'cadence-automator',
    });
  });

  return fastify;
}

/**
 * Start the server
 */
async function start() {
  const app = await buildApp();

  try {
    const port = parseInt(env.PORT, 10);
    const host = '0.0.0.0';

    await app.listen({ port, host });

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Cadence Automator API                                   ║
║                                                           ║
║   Server running at: http://localhost:${port}              ║
║                                                           ║
║   Endpoints:                                              ║
║   • GET  /health                   Health check           ║
║   • GET  /ready                    Ready check            ║
║   • /api/leads/*                   Leads CRUD             ║
║   • /api/cadences/*                Cadences CRUD          ║
║   • /api/execution/*               Step execution         ║
║   • /api/activity/*                Activity log           ║
║   • /api/unipile/*                 Unipile integration    ║
║   • /api/linkedin/*                LinkedIn actions       ║
║   • /webhooks/unipile              Webhook handler        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

// Start the server
start();
