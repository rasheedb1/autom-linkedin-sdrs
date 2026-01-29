import type { VercelResponse } from '@vercel/node';
import { withMiddleware, AuthenticatedRequest } from '../../lib/middleware/withMiddleware';
import { Router } from '../../lib/utils/router';
import { messageService } from '../../lib/services/message.service';
import { postsService } from '../../lib/services/posts.service';
import { loggingService } from '../../lib/services/logging.service';

const router = new Router();

// POST /api/linkedin/send-message - Send a single LinkedIn message
router.post('/send-message', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { lead_id, linkedin_url, message_body } = req.body;

  if (!lead_id || !linkedin_url || !message_body) {
    return res.status(400).json({ error: 'lead_id, linkedin_url, and message_body are required' });
  }

  const result = await messageService.sendMessageWithFallback({
    userId: req.user.id,
    leadId: lead_id,
    linkedinUrl: linkedin_url,
    messageBody: message_body,
  });

  // Log the result
  if (result.success) {
    await loggingService.logMessageSent(req.user.id, lead_id, result.channel!, result.requestId);
  } else {
    await loggingService.logMessageFailed(req.user.id, lead_id, result.errorCode || 'UNKNOWN', result.channel, result.requestId);
  }

  if (!result.success) {
    return res.status(400).json({
      success: false,
      status: 'error',
      provider: 'unipile',
      error: result.error,
      error_code: result.errorCode,
      lead_id,
      linkedin_url,
    });
  }

  res.status(200).json({
    success: true,
    status: 'success',
    provider: 'unipile',
    channel: result.channel,
    request_id: result.requestId,
    lead_id,
    linkedin_url,
  });
});

// POST /api/linkedin/send-all - Send messages to multiple leads
router.post('/send-all', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { leads, message_template } = req.body;

  if (!Array.isArray(leads) || leads.length === 0 || !message_template) {
    return res.status(400).json({ error: 'leads array and message_template are required' });
  }

  // Limit batch size to avoid timeout (Vercel 10s limit on hobby)
  const limitedLeads = leads.slice(0, 5);

  const result = await messageService.sendAll(
    req.user.id,
    limitedLeads,
    message_template,
    2 // concurrency
  );

  // Log the bulk operation
  await loggingService.logBulkSend(req.user.id, {
    total: result.total,
    sent: result.sent,
    failed: result.failed,
    linkedinMessageSent: result.linkedinMessageSent,
    salesnavInmailSent: result.salesnavInmailSent,
  });

  res.status(200).json({
    success: true,
    status: 'success',
    provider: 'unipile',
    total: result.total,
    sent: result.sent,
    failed: result.failed,
    linkedin_message_sent: result.linkedinMessageSent,
    salesnav_inmail_sent: result.salesnavInmailSent,
    results: result.results,
    remaining: leads.length - limitedLeads.length,
  });
});

// POST /api/linkedin/like-post - Like a lead's latest post
router.post('/like-post', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const { lead_id, linkedin_url } = req.body;

  if (!lead_id || !linkedin_url) {
    return res.status(400).json({ error: 'lead_id and linkedin_url are required' });
  }

  const result = await postsService.likeLastPost({
    userId: req.user.id,
    leadId: lead_id,
    linkedinUrl: linkedin_url,
  });

  // Log the result
  await loggingService.logLikePost(req.user.id, lead_id, result.success, result.errorCode, result.requestId);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      status: 'error',
      provider: 'unipile',
      error: result.error,
      error_code: result.errorCode,
      reason: result.reason,
      lead_id,
      linkedin_url,
    });
  }

  res.status(200).json({
    success: true,
    status: 'success',
    provider: 'unipile',
    liked_post_url: result.likedPostUrl,
    request_id: result.requestId,
    lead_id,
    linkedin_url,
  });
});

// Handler
export default withMiddleware(async (req: AuthenticatedRequest, res: VercelResponse) => {
  await router.handle(req, res);
});
