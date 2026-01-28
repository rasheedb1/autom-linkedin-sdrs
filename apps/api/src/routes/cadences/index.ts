import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CadenceService } from '../../services/cadence.service.js';
import type { StepType } from '../../types/database.js';

// Validation schemas
const createCadenceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['draft', 'active']).optional(),
});

const updateCadenceSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['draft', 'active']).optional(),
});

const stepTypeEnum = z.enum([
  'send_email',
  'linkedin_message',
  'linkedin_like',
  'linkedin_connect',
  'linkedin_comment',
  'whatsapp_message',
  'call_manual',
]);

const createStepSchema = z.object({
  step_type: stepTypeEnum,
  step_label: z.string().optional().nullable(),
  day_offset: z.number().int().min(0).optional(),
  order_in_day: z.number().int().min(1).optional(),
  config_json: z.record(z.unknown()).optional().nullable(),
});

const updateStepSchema = createStepSchema.partial();

const enrollLeadsSchema = z.object({
  lead_ids: z.array(z.string().uuid()),
});

const reorderStepsSchema = z.object({
  order: z.array(z.string().uuid()),
});

export async function cadencesRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  const getCadenceService = () => new CadenceService(fastify.supabaseAdmin);

  // =====================================================
  // CADENCE CRUD
  // =====================================================

  /**
   * GET /api/cadences - List all cadences
   */
  fastify.get('/', async (request, reply) => {
    const cadenceService = getCadenceService();
    const cadences = await cadenceService.getCadences(request.user!.id);

    return reply.send({
      success: true,
      data: cadences,
    });
  });

  /**
   * GET /api/cadences/:id - Get a single cadence with steps
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const cadenceService = getCadenceService();
    const cadence = await cadenceService.getCadence(request.user!.id, request.params.id);

    if (!cadence) {
      return reply.status(404).send({
        success: false,
        error: 'Cadence not found',
        error_code: 'NOT_FOUND',
      });
    }

    return reply.send({
      success: true,
      data: cadence,
    });
  });

  /**
   * POST /api/cadences - Create a new cadence
   */
  fastify.post('/', async (request, reply) => {
    const validation = createCadenceSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const cadenceService = getCadenceService();
    const cadence = await cadenceService.createCadence(request.user!.id, validation.data);

    return reply.status(201).send({
      success: true,
      data: cadence,
    });
  });

  /**
   * PUT /api/cadences/:id - Update a cadence
   */
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const validation = updateCadenceSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const cadenceService = getCadenceService();
    const cadence = await cadenceService.updateCadence(
      request.user!.id,
      request.params.id,
      validation.data
    );

    return reply.send({
      success: true,
      data: cadence,
    });
  });

  /**
   * DELETE /api/cadences/:id - Delete a cadence
   */
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const cadenceService = getCadenceService();
    await cadenceService.deleteCadence(request.user!.id, request.params.id);

    return reply.send({
      success: true,
      message: 'Cadence deleted',
    });
  });

  /**
   * POST /api/cadences/:id/activate - Activate a cadence
   */
  fastify.post<{ Params: { id: string } }>('/:id/activate', async (request, reply) => {
    const cadenceService = getCadenceService();
    const cadence = await cadenceService.activateCadence(request.user!.id, request.params.id);

    return reply.send({
      success: true,
      data: cadence,
    });
  });

  /**
   * POST /api/cadences/:id/pause - Pause a cadence
   */
  fastify.post<{ Params: { id: string } }>('/:id/pause', async (request, reply) => {
    const cadenceService = getCadenceService();
    const cadence = await cadenceService.pauseCadence(request.user!.id, request.params.id);

    return reply.send({
      success: true,
      data: cadence,
    });
  });

  // =====================================================
  // CADENCE STEPS
  // =====================================================

  /**
   * GET /api/cadences/:id/steps - List steps
   */
  fastify.get<{ Params: { id: string } }>('/:id/steps', async (request, reply) => {
    const cadenceService = getCadenceService();
    const steps = await cadenceService.getSteps(request.user!.id, request.params.id);

    return reply.send({
      success: true,
      data: steps,
    });
  });

  /**
   * POST /api/cadences/:id/steps - Create a step
   */
  fastify.post<{ Params: { id: string } }>('/:id/steps', async (request, reply) => {
    const validation = createStepSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const cadenceService = getCadenceService();
    const step = await cadenceService.createStep(
      request.user!.id,
      request.params.id,
      validation.data as { step_type: StepType; step_label?: string | null; day_offset?: number; order_in_day?: number; config_json?: Record<string, unknown> | null }
    );

    return reply.status(201).send({
      success: true,
      data: step,
    });
  });

  /**
   * PUT /api/cadences/:cadenceId/steps/:stepId - Update a step
   */
  fastify.put<{ Params: { id: string; stepId: string } }>(
    '/:id/steps/:stepId',
    async (request, reply) => {
      const validation = updateStepSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          error_code: 'VALIDATION_ERROR',
          details: validation.error.flatten(),
        });
      }

      const cadenceService = getCadenceService();
      const step = await cadenceService.updateStep(
        request.user!.id,
        request.params.stepId,
        validation.data as { step_type?: StepType; step_label?: string | null; day_offset?: number; order_in_day?: number; config_json?: Record<string, unknown> | null }
      );

      return reply.send({
        success: true,
        data: step,
      });
    }
  );

  /**
   * DELETE /api/cadences/:cadenceId/steps/:stepId - Delete a step
   */
  fastify.delete<{ Params: { id: string; stepId: string } }>(
    '/:id/steps/:stepId',
    async (request, reply) => {
      const cadenceService = getCadenceService();
      await cadenceService.deleteStep(request.user!.id, request.params.stepId);

      return reply.send({
        success: true,
        message: 'Step deleted',
      });
    }
  );

  /**
   * POST /api/cadences/:id/steps/reorder - Reorder steps
   */
  fastify.post<{ Params: { id: string } }>('/:id/steps/reorder', async (request, reply) => {
    const validation = reorderStepsSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const cadenceService = getCadenceService();
    const steps = await cadenceService.reorderSteps(
      request.user!.id,
      request.params.id,
      validation.data.order
    );

    return reply.send({
      success: true,
      data: steps,
    });
  });

  // =====================================================
  // CADENCE LEADS (Enrollment)
  // =====================================================

  /**
   * GET /api/cadences/:id/leads - List enrolled leads
   */
  fastify.get<{ Params: { id: string } }>('/:id/leads', async (request, reply) => {
    const cadenceService = getCadenceService();
    const leads = await cadenceService.getCadenceLeads(request.user!.id, request.params.id);

    return reply.send({
      success: true,
      data: leads,
    });
  });

  /**
   * POST /api/cadences/:id/leads - Enroll leads
   */
  fastify.post<{ Params: { id: string } }>('/:id/leads', async (request, reply) => {
    const validation = enrollLeadsSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const cadenceService = getCadenceService();
    const enrolled = await cadenceService.enrollLeads(
      request.user!.id,
      request.params.id,
      validation.data.lead_ids
    );

    return reply.status(201).send({
      success: true,
      data: enrolled,
      enrolled: enrolled.length,
    });
  });

  /**
   * DELETE /api/cadences/:id/leads/:leadId - Unenroll a lead
   */
  fastify.delete<{ Params: { id: string; leadId: string } }>(
    '/:id/leads/:leadId',
    async (request, reply) => {
      const cadenceService = getCadenceService();
      await cadenceService.unenrollLead(
        request.user!.id,
        request.params.id,
        request.params.leadId
      );

      return reply.send({
        success: true,
        message: 'Lead unenrolled',
      });
    }
  );

  /**
   * POST /api/cadences/:id/leads/:cadenceLeadId/pause - Pause a lead
   */
  fastify.post<{ Params: { id: string; cadenceLeadId: string } }>(
    '/:id/leads/:cadenceLeadId/pause',
    async (request, reply) => {
      const cadenceService = getCadenceService();
      const cadenceLead = await cadenceService.pauseLead(
        request.user!.id,
        request.params.cadenceLeadId
      );

      return reply.send({
        success: true,
        data: cadenceLead,
      });
    }
  );

  /**
   * POST /api/cadences/:id/leads/:cadenceLeadId/resume - Resume a lead
   */
  fastify.post<{ Params: { id: string; cadenceLeadId: string } }>(
    '/:id/leads/:cadenceLeadId/resume',
    async (request, reply) => {
      const cadenceService = getCadenceService();
      const cadenceLead = await cadenceService.resumeLead(
        request.user!.id,
        request.params.cadenceLeadId
      );

      return reply.send({
        success: true,
        data: cadenceLead,
      });
    }
  );

  /**
   * GET /api/cadences/:id/leads/:cadenceLeadId/steps - Get step instances
   */
  fastify.get<{ Params: { id: string; cadenceLeadId: string } }>(
    '/:id/leads/:cadenceLeadId/steps',
    async (request, reply) => {
      const cadenceService = getCadenceService();
      const instances = await cadenceService.getLeadStepInstances(
        request.user!.id,
        request.params.cadenceLeadId
      );

      return reply.send({
        success: true,
        data: instances,
      });
    }
  );
}
