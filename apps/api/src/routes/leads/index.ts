import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LeadService } from '../../services/lead.service.js';
import type { LeadInsert, LeadUpdate } from '../../types/database.js';

// Validation schemas
const createLeadSchema = z.object({
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  linkedin_url: z.string().url().optional().nullable(),
  company: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
});

const updateLeadSchema = createLeadSchema.partial();

const importLeadsSchema = z.object({
  leads: z.array(createLeadSchema),
});

export async function leadsRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  const getLeadService = () => new LeadService(fastify.supabaseAdmin);

  /**
   * GET /api/leads - List all leads
   */
  fastify.get('/', async (request, reply) => {
    const { search, limit, offset } = request.query as {
      search?: string;
      limit?: string;
      offset?: string;
    };

    const leadService = getLeadService();
    const result = await leadService.getLeads(request.user!.id, {
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return reply.send({
      success: true,
      data: result.leads,
      total: result.total,
    });
  });

  /**
   * GET /api/leads/:id - Get a single lead
   */
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const leadService = getLeadService();
    const lead = await leadService.getLead(request.user!.id, request.params.id);

    if (!lead) {
      return reply.status(404).send({
        success: false,
        error: 'Lead not found',
        error_code: 'NOT_FOUND',
      });
    }

    return reply.send({
      success: true,
      data: lead,
    });
  });

  /**
   * POST /api/leads - Create a new lead
   */
  fastify.post('/', async (request, reply) => {
    const validation = createLeadSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const leadService = getLeadService();
    const lead = await leadService.createLead(request.user!.id, validation.data as Omit<LeadInsert, 'owner_id'>);

    return reply.status(201).send({
      success: true,
      data: lead,
    });
  });

  /**
   * POST /api/leads/import - Bulk import leads
   */
  fastify.post('/import', async (request, reply) => {
    const validation = importLeadsSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const leadService = getLeadService();
    const leads = await leadService.createLeads(
      request.user!.id,
      validation.data.leads as Omit<LeadInsert, 'owner_id'>[]
    );

    return reply.status(201).send({
      success: true,
      data: leads,
      imported: leads.length,
    });
  });

  /**
   * PUT /api/leads/:id - Update a lead
   */
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const validation = updateLeadSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        error_code: 'VALIDATION_ERROR',
        details: validation.error.flatten(),
      });
    }

    const leadService = getLeadService();

    // Check if lead exists
    const existing = await leadService.getLead(request.user!.id, request.params.id);
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: 'Lead not found',
        error_code: 'NOT_FOUND',
      });
    }

    const lead = await leadService.updateLead(
      request.user!.id,
      request.params.id,
      validation.data as LeadUpdate
    );

    return reply.send({
      success: true,
      data: lead,
    });
  });

  /**
   * DELETE /api/leads/:id - Delete a lead
   */
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const leadService = getLeadService();

    // Check if lead exists
    const existing = await leadService.getLead(request.user!.id, request.params.id);
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: 'Lead not found',
        error_code: 'NOT_FOUND',
      });
    }

    await leadService.deleteLead(request.user!.id, request.params.id);

    return reply.send({
      success: true,
      message: 'Lead deleted',
    });
  });

  /**
   * DELETE /api/leads - Bulk delete leads
   */
  fastify.delete('/', async (request, reply) => {
    const { ids } = request.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'ids array is required',
        error_code: 'VALIDATION_ERROR',
      });
    }

    const leadService = getLeadService();
    await leadService.deleteLeads(request.user!.id, ids);

    return reply.send({
      success: true,
      message: `${ids.length} leads deleted`,
    });
  });
}
