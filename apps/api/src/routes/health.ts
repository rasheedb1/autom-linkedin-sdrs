import { FastifyInstance, FastifyPluginOptions } from 'fastify';

/**
 * Health check routes
 */
export async function healthRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * Basic health check
   */
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'cadence-automator-api',
    };
  });

  /**
   * Ready check (includes database connectivity)
   */
  fastify.get('/ready', async (_request, reply) => {
    try {
      // Test Supabase connection using admin client
      const { error } = await fastify.supabaseAdmin
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) {
        fastify.log.error({ error }, 'Database check failed');
        return reply.status(503).send({
          status: 'not_ready',
          error: 'Database connection failed',
          details: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'cadence-automator-api',
        checks: {
          database: 'ok',
        },
      };
    } catch (err) {
      fastify.log.error({ err }, 'Health check exception');
      return reply.status(503).send({
        status: 'not_ready',
        error: 'Health check failed',
        details: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });
}

export default healthRoutes;
