import type { FastifyInstance } from 'fastify';
import { ActivityService } from '../../services/activity.service.js';

export async function activityRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  const getActivityService = () => new ActivityService(fastify.supabaseAdmin);

  /**
   * GET /api/activity - Get activity log with filters
   */
  fastify.get('/', async (request, reply) => {
    const {
      cadence_id,
      lead_id,
      action,
      status,
      from,
      to,
      limit,
      offset,
    } = request.query as {
      cadence_id?: string;
      lead_id?: string;
      action?: string;
      status?: 'ok' | 'failed';
      from?: string;
      to?: string;
      limit?: string;
      offset?: string;
    };

    const activityService = getActivityService();

    const result = await activityService.getActivityLog(request.user!.id, {
      cadenceId: cadence_id,
      leadId: lead_id,
      action,
      status,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return reply.send({
      success: true,
      data: result.logs,
      total: result.total,
    });
  });

  /**
   * GET /api/activity/recent - Get recent activity for dashboard
   */
  fastify.get('/recent', async (request, reply) => {
    const { limit } = request.query as { limit?: string };

    const activityService = getActivityService();

    const activity = await activityService.getRecentActivity(
      request.user!.id,
      limit ? parseInt(limit, 10) : 10
    );

    return reply.send({
      success: true,
      data: activity,
    });
  });

  /**
   * GET /api/activity/stats - Get activity stats
   */
  fastify.get('/stats', async (request, reply) => {
    const { days, cadence_id } = request.query as {
      days?: string;
      cadence_id?: string;
    };

    const activityService = getActivityService();

    const stats = await activityService.getActivityStats(request.user!.id, {
      days: days ? parseInt(days, 10) : 7,
      cadenceId: cadence_id,
    });

    return reply.send({
      success: true,
      data: stats,
    });
  });
}
