import type { FastifyInstance } from 'fastify';
import { TemplateService } from '../../services/template.service.js';

export async function templatesRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  const getTemplateService = () => new TemplateService(fastify.supabaseAdmin);

  /**
   * GET /api/templates - Get all templates
   */
  fastify.get('/', async (request, reply) => {
    const { step_type } = request.query as { step_type?: string };
    const templateService = getTemplateService();

    let templates;
    if (step_type) {
      templates = await templateService.getTemplatesByType(request.user!.id, step_type);
    } else {
      templates = await templateService.getTemplates(request.user!.id);
    }

    return reply.send({
      success: true,
      data: templates,
    });
  });

  /**
   * GET /api/templates/:id - Get a single template
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const templateService = getTemplateService();

    const template = await templateService.getTemplate(request.user!.id, id);

    if (!template) {
      return reply.status(404).send({
        success: false,
        error: 'Template not found',
        error_code: 'NOT_FOUND',
      });
    }

    return reply.send({
      success: true,
      data: template,
    });
  });

  /**
   * POST /api/templates - Create a new template
   */
  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      name: string;
      step_type: string;
      subject_template?: string;
      body_template: string;
    };

    if (!body.name || !body.step_type || !body.body_template) {
      return reply.status(400).send({
        success: false,
        error: 'name, step_type, and body_template are required',
        error_code: 'VALIDATION_ERROR',
      });
    }

    const templateService = getTemplateService();

    const template = await templateService.createTemplate(request.user!.id, {
      name: body.name,
      step_type: body.step_type,
      subject_template: body.subject_template,
      body_template: body.body_template,
    });

    return reply.status(201).send({
      success: true,
      data: template,
    });
  });

  /**
   * PUT /api/templates/:id - Update a template
   */
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      step_type?: string;
      subject_template?: string | null;
      body_template?: string;
    };

    const templateService = getTemplateService();

    const template = await templateService.updateTemplate(request.user!.id, id, body);

    if (!template) {
      return reply.status(404).send({
        success: false,
        error: 'Template not found',
        error_code: 'NOT_FOUND',
      });
    }

    return reply.send({
      success: true,
      data: template,
    });
  });

  /**
   * DELETE /api/templates/:id - Delete a template
   */
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const templateService = getTemplateService();

    const deleted = await templateService.deleteTemplate(request.user!.id, id);

    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: 'Template not found',
        error_code: 'NOT_FOUND',
      });
    }

    return reply.send({
      success: true,
      message: 'Template deleted',
    });
  });

  /**
   * POST /api/templates/:id/render - Preview rendered template
   */
  fastify.post('/:id/render', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      lead_data: Record<string, string | null | undefined>;
    };

    const templateService = getTemplateService();

    const template = await templateService.getTemplate(request.user!.id, id);

    if (!template) {
      return reply.status(404).send({
        success: false,
        error: 'Template not found',
        error_code: 'NOT_FOUND',
      });
    }

    const renderedBody = templateService.renderTemplate(template.body_template, body.lead_data || {});
    const renderedSubject = template.subject_template
      ? templateService.renderTemplate(template.subject_template, body.lead_data || {})
      : null;

    return reply.send({
      success: true,
      data: {
        subject: renderedSubject,
        body: renderedBody,
      },
    });
  });
}
