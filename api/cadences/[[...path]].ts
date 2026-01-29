import type { VercelResponse } from '@vercel/node';
import { withMiddleware, AuthenticatedRequest } from '../../lib/middleware/withMiddleware';
import { Router } from '../../lib/utils/router';
import { cadenceService } from '../../lib/services/cadence.service';

const router = new Router();

// GET /api/cadences - List all cadences
router.get('/', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const cadences = await cadenceService.getCadences(req.user.id);
  res.status(200).json(cadences);
});

// GET /api/cadences/:id - Get single cadence with steps
router.get('/:id', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const cadence = await cadenceService.getCadence(req.user.id, params.id);

  if (!cadence) {
    return res.status(404).json({ error: 'Cadence not found' });
  }

  res.status(200).json(cadence);
});

// GET /api/cadences/:id/leads - Get leads in cadence
router.get('/:id/leads', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const leads = await cadenceService.getCadenceLeads(req.user.id, params.id);
  res.status(200).json(leads);
});

// GET /api/cadences/:id/steps - Get steps in cadence
router.get('/:id/steps', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const steps = await cadenceService.getSteps(req.user.id, params.id);
  res.status(200).json(steps);
});

// POST /api/cadences - Create cadence
router.post('/', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { name, status } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const cadence = await cadenceService.createCadence(req.user.id, { name, status });
  res.status(201).json(cadence);
});

// POST /api/cadences/:id/steps - Add step to cadence
router.post('/:id/steps', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const { step_type, step_label, day_offset, order_in_day, config_json } = req.body;

  if (!step_type) {
    return res.status(400).json({ error: 'step_type is required' });
  }

  const step = await cadenceService.createStep(req.user.id, params.id, {
    step_type,
    step_label,
    day_offset,
    order_in_day,
    config_json,
  });

  res.status(201).json(step);
});

// POST /api/cadences/:id/leads - Add leads to cadence
router.post('/:id/leads', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const { lead_ids } = req.body;

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return res.status(400).json({ error: 'lead_ids array is required' });
  }

  const result = await cadenceService.enrollLeads(req.user.id, params.id, lead_ids);
  res.status(201).json(result);
});

// POST /api/cadences/:id/activate - Activate cadence
router.post('/:id/activate', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const cadence = await cadenceService.activateCadence(req.user.id, params.id);
  res.status(200).json(cadence);
});

// POST /api/cadences/:id/pause - Pause cadence
router.post('/:id/pause', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const cadence = await cadenceService.pauseCadence(req.user.id, params.id);
  res.status(200).json(cadence);
});

// PUT /api/cadences/:id - Update cadence
router.put('/:id', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const { name, status } = req.body;

  const cadence = await cadenceService.updateCadence(req.user.id, params.id, { name, status });
  res.status(200).json(cadence);
});

// PUT /api/cadences/:cadenceId/steps/:stepId - Update step
router.put('/:cadenceId/steps/:stepId', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const { step_type, step_label, day_offset, order_in_day, config_json } = req.body;

  const step = await cadenceService.updateStep(req.user.id, params.stepId, {
    step_type,
    step_label,
    day_offset,
    order_in_day,
    config_json,
  });

  res.status(200).json(step);
});

// DELETE /api/cadences/:id - Delete cadence
router.delete('/:id', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  await cadenceService.deleteCadence(req.user.id, params.id);
  res.status(204).end();
});

// DELETE /api/cadences/:cadenceId/steps/:stepId - Delete step
router.delete('/:cadenceId/steps/:stepId', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  await cadenceService.deleteStep(req.user.id, params.stepId);
  res.status(204).end();
});

// DELETE /api/cadences/:id/leads/:leadId - Remove lead from cadence
router.delete('/:id/leads/:leadId', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  await cadenceService.unenrollLead(req.user.id, params.id, params.leadId);
  res.status(204).end();
});

// Handler
export default withMiddleware(async (req: AuthenticatedRequest, res: VercelResponse) => {
  await router.handle(req, res);
});
