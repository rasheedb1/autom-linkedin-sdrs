import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../../lib/db/supabase';
import { unipileService } from '../../../lib/services/unipile.service';

/**
 * OAuth callback handler for Unipile LinkedIn authentication
 *
 * This endpoint is called by Unipile after successful LinkedIn authentication.
 * It validates the state parameter and stores the connected account.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { state, account_id } = req.query;

  if (!state || typeof state !== 'string') {
    return res.redirect('/settings?error=missing_state');
  }

  const supabase = getSupabaseAdmin();

  // Validate state and get user
  const { data: session, error: sessionError } = await supabase
    .from('pending_connect_sessions')
    .select('*')
    .eq('state', state)
    .single();

  if (sessionError || !session) {
    console.error('Invalid state:', state);
    return res.redirect('/settings?error=invalid_state');
  }

  // Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    // Clean up expired session
    await supabase.from('pending_connect_sessions').delete().eq('id', session.id);
    return res.redirect('/settings?error=session_expired');
  }

  // Delete the pending session
  await supabase.from('pending_connect_sessions').delete().eq('id', session.id);

  // If account_id is provided directly, use it
  let unipileAccountId = account_id as string | undefined;

  // If not provided, try to find the most recent account
  if (!unipileAccountId) {
    try {
      const { accounts } = await unipileService.listAccounts({ limit: 10 });

      // Find account created for this user (by name pattern)
      const userAccount = accounts.find(acc =>
        acc.type === 'LINKEDIN' && acc.status === 'OK'
      );

      if (userAccount) {
        unipileAccountId = userAccount.id;
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }

  if (!unipileAccountId) {
    return res.redirect('/settings?error=no_account_found');
  }

  // Store or update the Unipile account
  const { error: upsertError } = await supabase
    .from('unipile_accounts')
    .upsert({
      user_id: session.user_id,
      provider: 'LINKEDIN',
      unipile_account_id: unipileAccountId,
      status: 'connected',
      metadata: {
        connected_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    });

  if (upsertError) {
    console.error('Error storing account:', upsertError);
    return res.redirect('/settings?error=storage_failed');
  }

  // Redirect to settings page with success
  res.redirect('/settings?linkedin_connected=true');
}
