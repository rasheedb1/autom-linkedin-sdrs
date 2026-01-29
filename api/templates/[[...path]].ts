import type { VercelResponse } from '@vercel/node';
import { withMiddleware, AuthenticatedRequest } from '../../lib/middleware/withMiddleware';
import { Router } from '../../lib/utils/router';
import { templateService } from '../../lib/services/template.service';

const router = new Router();

// GET /api/templates - List all templates
router.get('/', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const templates = await templateService.getTemplates(req.user.id);
  res.status(200).json(templates);
});

// GET /api/templates/by-type/:stepType - Get templates by type
router.get('/by-type/:stepType', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const templates = await templateService.getTemplatesByType(req.user.id, params.stepType);
  res.status(200).json(templates);
});

// GET /api/templates/:id - Get single template
router.get('/:id', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const template = await templateService.getTemplate(req.user.id, params.id);

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.status(200).json(template);
});

// POST /api/templates - Create template
router.post('/', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { name, step_type, subject_template, body_template } = req.body;

  if (!name || !step_type || !body_template) {
    return res.status(400).json({ error: 'name, step_type, and body_template are required' });
  }

  const template = await templateService.createTemplate(req.user.id, {
    name,
    step_type,
    subject_template,
    body_template,
  });

  res.status(201).json(template);
});

// POST /api/templates/render - Preview template rendering
router.post('/render', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { template, lead_data } = req.body;

  if (!template) {
    return res.status(400).json({ error: 'template is required' });
  }

  const rendered = templateService.renderTemplate(template, lead_data || {});
  res.status(200).json({ rendered });
});

// PUT /api/templates/:id - Update template
router.put('/:id', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const { name, step_type, subject_template, body_template } = req.body;

  const template = await templateService.updateTemplate(req.user.id, params.id, {
    name,
    step_type,
    subject_template,
    body_template,
  });

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.status(200).json(template);
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const deleted = await templateService.deleteTemplate(req.user.id, params.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.status(204).end();
});

// Handler
export default withMiddleware(async (req: AuthenticatedRequest, res: VercelResponse) => {
  await router.handle(req, res);
});
