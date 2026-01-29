import type { VercelResponse } from '@vercel/node';
import { withMiddleware, AuthenticatedRequest } from '../../lib/middleware/withMiddleware';
import { Router } from '../../lib/utils/router';
import { activityService } from '../../lib/services/activity.service';

const router = new Router();

// GET /api/activity - Get activity log
router.get('/', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const cadenceId = req.query.cadence_id as string | undefined;
  const leadId = req.query.lead_id as string | undefined;

  const result = await activityService.getActivityLog(req.user.id, {
    limit,
    offset,
    cadenceId,
    leadId,
  });

  res.status(200).json(result);
});

// GET /api/activity/recent - Get recent activity
router.get('/recent', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const limit = parseInt(req.query.limit as string) || 10;

  const activities = await activityService.getRecentActivity(req.user.id, limit);
  res.status(200).json(activities);
});

// GET /api/activity/stats - Get activity statistics
router.get('/stats', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const cadenceId = req.query.cadence_id as string | undefined;
  const days = parseInt(req.query.days as string) || 7;

  const stats = await activityService.getActivityStats(req.user.id, { cadenceId, days });
  res.status(200).json(stats);
});

// Handler
export default withMiddleware(async (req: AuthenticatedRequest, res: VercelResponse) => {
  await router.handle(req, res);
});
