import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ExecutionService } from '../../services/execution.service.js';

// Validation schemas
const executeStepSchema = z.object({
  cadence_lead_id: z.string().uuid(),
  step_id: z.string().uuid(),
});

const executeNextSchema = z.object({
  cadence_lead_id: z.string().uuid(),
});

const executeBatchSchema = z.object({
  cadence_id: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function executionRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  const getExecutionService = () => new ExecutionService(fastify.supabaseAdmin);

  /**
   * POST /api/execution/send - Execute a specific step for a lead
   */
  fastify.post('/send', async (request, reply) => {
    const validation = executeStepSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const { cadence_lead_id, step_id } = validation.data;
    const executionService = getExecutionService();

    const result = await executionService.executeStep(
      request.user!.id,
      cadence_lead_id,
      step_id
    );

    if (!result.success) {
      return reply.status(200).send({
        success: false,
        error: result.error,
        error_code: result.errorCode,
      });
    }

    return reply.send({
      success: true,
      data: {
        step_instance_id: result.stepInstanceId,
        channel: result.channel,
        request_id: result.requestId,
      },
    });
  });

  /**
   * POST /api/execution/send-next - Execute the next pending step for a lead
   */
  fastify.post('/send-next', async (request, reply) => {
    const validation = executeNextSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const { cadence_lead_id } = validation.data;
    const executionService = getExecutionService();

    const result = await executionService.executeNextStep(
      request.user!.id,
      cadence_lead_id
    );

    if (!result.success) {
      return reply.status(200).send({
        success: false,
        error: result.error,
        error_code: result.errorCode,
      });
    }

    return reply.send({
      success: true,
      data: {
        step_instance_id: result.stepInstanceId,
        channel: result.channel,
        request_id: result.requestId,
      },
    });
  });

  /**
   * POST /api/execution/send-all - Execute batch for a cadence
   */
  fastify.post('/send-all', async (request, reply) => {
    const validation = executeBatchSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const { cadence_id, limit } = validation.data;
    const executionService = getExecutionService();

    const result = await executionService.executeBatch(
      request.user!.id,
      cadence_id,
      limit
    );

    return reply.send({
      success: true,
      data: {
        total: result.total,
        executed: result.executed,
        failed: result.failed,
        skipped: result.skipped,
        results: result.results,
      },
    });
  });

  /**
   * GET /api/execution/pending/:cadenceId - Get pending leads for a cadence
   */
  fastify.get<{ Params: { cadenceId: string } }>('/pending/:cadenceId', async (request, reply) => {
    const executionService = getExecutionService();

    const leads = await executionService.getPendingLeads(
      request.user!.id,
      request.params.cadenceId
    );

    return reply.send({
      success: true,
      data: leads,
      total: leads.length,
    });
  });

  /**
   * GET /api/execution/stats/weekly - Get weekly message stats
   */
  fastify.get('/stats/weekly', async (request, reply) => {
    const executionService = getExecutionService();

    const stats = await executionService.getWeeklyStats(request.user!.id);

    return reply.send({
      success: true,
      data: stats,
    });
  });
}
