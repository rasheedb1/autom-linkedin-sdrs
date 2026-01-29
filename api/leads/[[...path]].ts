import type { VercelResponse } from '@vercel/node';
import { withMiddleware, AuthenticatedRequest } from '../../lib/middleware/withMiddleware';
import { Router } from '../../lib/utils/router';
import { leadService } from '../../lib/services/lead.service';

const router = new Router();

// GET /api/leads - List all leads
router.get('/', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const search = req.query.search as string | undefined;
  const limit = parseInt(req.query.limit as string) || undefined;
  const offset = parseInt(req.query.offset as string) || undefined;

  const result = await leadService.getLeads(req.user.id, { search, limit, offset });
  res.status(200).json(result);
});

// GET /api/leads/:id - Get single lead
router.get('/:id', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const lead = await leadService.getLead(req.user.id, params.id);

  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  res.status(200).json(lead);
});

// POST /api/leads - Create lead
router.post('/', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { first_name, last_name, email, linkedin_url, company, title, phone, timezone } = req.body;

  if (!first_name && !last_name && !email && !linkedin_url) {
    return res.status(400).json({ error: 'At least one field is required' });
  }

  const lead = await leadService.createLead(req.user.id, {
    first_name,
    last_name,
    email,
    linkedin_url,
    company,
    title,
    phone,
    timezone,
  });

  res.status(201).json(lead);
});

// POST /api/leads/bulk - Bulk create leads
router.post('/bulk', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { leads } = req.body;

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'leads array is required' });
  }

  const result = await leadService.createLeads(req.user.id, leads);
  res.status(201).json({ created: result.length, leads: result });
});

// PUT /api/leads/:id - Update lead
router.put('/:id', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  const { first_name, last_name, email, linkedin_url, company, title, phone, timezone } = req.body;

  try {
    const lead = await leadService.updateLead(req.user.id, params.id, {
      first_name,
      last_name,
      email,
      linkedin_url,
      company,
      title,
      phone,
      timezone,
    });

    res.status(200).json(lead);
  } catch (error) {
    return res.status(404).json({ error: 'Lead not found' });
  }
});

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', async (req: AuthenticatedRequest, res: VercelResponse, params) => {
  try {
    await leadService.deleteLead(req.user.id, params.id);
    res.status(204).end();
  } catch (error) {
    return res.status(404).json({ error: 'Lead not found' });
  }
});

// DELETE /api/leads/bulk - Bulk delete leads
router.delete('/bulk', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { lead_ids } = req.body;

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return res.status(400).json({ error: 'lead_ids array is required' });
  }

  await leadService.deleteLeads(req.user.id, lead_ids);
  res.status(204).end();
});

// Handler
export default withMiddleware(async (req: AuthenticatedRequest, res: VercelResponse) => {
  await router.handle(req, res);
});
