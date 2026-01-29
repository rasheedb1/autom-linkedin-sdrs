import type { VercelResponse } from '@vercel/node';
import { withMiddleware, AuthenticatedRequest } from '../../lib/middleware/withMiddleware';
import { Router } from '../../lib/utils/router';
import { unipileService } from '../../lib/services/unipile.service';
import { loggingService } from '../../lib/services/logging.service';
import { getSupabaseAdmin } from '../../lib/db/supabase';

const router = new Router();

// GET /api/unipile/status - Get connection status
router.get('/status', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const supabase = getSupabaseAdmin();

  const { data: account } = await supabase
    .from('unipile_accounts')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('provider', 'LINKEDIN')
    .single();

  if (!account) {
    return res.status(200).json({
      connected: false,
      status: null,
    });
  }

  // Optionally verify with Unipile
  try {
    const { account: unipileAccount } = await unipileService.getAccount(account.unipile_account_id);
    res.status(200).json({
      connected: unipileAccount.status === 'OK',
      status: unipileAccount.status,
      account_id: account.unipile_account_id,
    });
  } catch (error) {
    res.status(200).json({
      connected: false,
      status: 'ERROR',
      account_id: account.unipile_account_id,
    });
  }
});

// GET /api/unipile/balance - Get InMail credits balance
router.get('/balance', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const supabase = getSupabaseAdmin();

  const { data: account } = await supabase
    .from('unipile_accounts')
    .select('unipile_account_id')
    .eq('user_id', req.user.id)
    .eq('provider', 'LINKEDIN')
    .eq('status', 'connected')
    .single();

  if (!account) {
    await loggingService.logBalanceCheck(req.user.id, false, undefined, 'NO_ACCOUNT');
    return res.status(400).json({
      success: false,
      error: 'No connected LinkedIn account',
      error_code: 'NO_ACCOUNT',
    });
  }

  try {
    const { credits } = await unipileService.getInMailCredits(account.unipile_account_id);
    await loggingService.logBalanceCheck(req.user.id, true, credits);

    res.status(200).json({
      success: true,
      status: 'success',
      provider: 'unipile',
      sales_navigator_credits: credits,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await loggingService.logBalanceCheck(req.user.id, false, undefined, errorMessage);

    res.status(400).json({
      success: false,
      error: errorMessage,
      error_code: 'BALANCE_ERROR',
    });
  }
});

// POST /api/unipile/connect - Initiate LinkedIn connection
router.post('/connect', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const supabase = getSupabaseAdmin();

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Store pending session
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await supabase.from('pending_connect_sessions').insert({
    user_id: req.user.id,
    state,
    provider: 'LINKEDIN',
    expires_at: expiresAt.toISOString(),
  });

  // Get the base URL from environment or request
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

  const webhookUrl = `${baseUrl}/api/webhooks/unipile`;
  const successUrl = `${baseUrl}/api/auth/unipile/callback?state=${state}`;
  const failureUrl = `${baseUrl}/settings?error=linkedin_connect_failed`;

  try {
    const { authUrl } = await unipileService.createHostedAuthLink({
      notifyUrl: webhookUrl,
      successRedirectUrl: successUrl,
      failureRedirectUrl: failureUrl,
      name: `cadence-automator-${req.user.id}`,
    });

    await loggingService.logLinkedInConnect(req.user.id, true);

    res.status(200).json({
      success: true,
      status: 'success',
      provider: 'unipile',
      auth_url: authUrl,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await loggingService.logLinkedInConnect(req.user.id, false, errorMessage);

    res.status(400).json({
      success: false,
      error: errorMessage,
      error_code: 'CONNECT_ERROR',
    });
  }
});

// POST /api/unipile/disconnect - Disconnect LinkedIn account
router.post('/disconnect', async (req: AuthenticatedRequest, res: VercelResponse) => {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('unipile_accounts')
    .delete()
    .eq('user_id', req.user.id)
    .eq('provider', 'LINKEDIN');

  if (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  res.status(200).json({
    success: true,
    message: 'LinkedIn account disconnected',
  });
});

// Handler
export default withMiddleware(async (req: AuthenticatedRequest, res: VercelResponse) => {
  await router.handle(req, res);
});
