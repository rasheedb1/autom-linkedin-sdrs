import type { VercelResponse } from '@vercel/node';
import { withMiddleware, AuthenticatedRequest } from '../../lib/middleware/withMiddleware';
import { Router } from '../../lib/utils/router';
import { executionService } from '../../lib/services/execution.service';

const router = new Router();

// GET /api/execution/stats - Get weekly execution stats
router.get('/stats', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const stats = await executionService.getWeeklyStats(req.user.id);
  res.status(200).json(stats);
});

// GET /api/execution/pending/:cadenceId - Get pending leads for a cadence
router.get('/pending/:cadenceId', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const pendingLeads = await executionService.getPendingLeads(req.user.id, params.cadenceId);
  res.status(200).json(pendingLeads);
});

// POST /api/execution/step - Execute a specific step for a cadence lead
router.post('/step', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { cadence_lead_id, step_id } = req.body;

  if (!cadence_lead_id || !step_id) {
    return res.status(400).json({ error: 'cadence_lead_id and step_id are required' });
  }

  const result = await executionService.executeStep(req.user.id, cadence_lead_id, step_id);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error,
      error_code: result.errorCode,
    });
  }

  res.status(200).json({
    success: true,
    step_instance_id: result.stepInstanceId,
    channel: result.channel,
    request_id: result.requestId,
  });
});

// POST /api/execution/next - Execute next step for a cadence lead
router.post('/next', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { cadence_lead_id } = req.body;

  if (!cadence_lead_id) {
    return res.status(400).json({ error: 'cadence_lead_id is required' });
  }

  const result = await executionService.executeNextStep(req.user.id, cadence_lead_id);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error,
      error_code: result.errorCode,
    });
  }

  res.status(200).json({
    success: true,
    step_instance_id: result.stepInstanceId,
    channel: result.channel,
    request_id: result.requestId,
  });
});

// POST /api/execution/batch - Execute batch for a cadence
router.post('/batch', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { cadence_id, limit } = req.body;

  if (!cadence_id) {
    return res.status(400).json({ error: 'cadence_id is required' });
  }

  // Limit batch size to avoid timeout
  const batchLimit = Math.min(limit || 5, 5);

  const result = await executionService.executeBatch(req.user.id, cadence_id, batchLimit);

  res.status(200).json({
    success: true,
    total: result.total,
    executed: result.executed,
    failed: result.failed,
    skipped: result.skipped,
    results: result.results,
  });
});

// Handler
export default withMiddleware(async (req: AuthenticatedRequest, res: VercelResponse) => {
  await router.handle(req, res);
});
