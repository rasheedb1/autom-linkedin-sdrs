import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../lib/db/supabase';

interface UnipileWebhookEvent {
  event: string;
  account_id: string;
  status?: string;
  previous_status?: string;
  data?: Record<string, unknown>;
}

/**
 * Webhook handler for Unipile events
 *
 * This endpoint receives notifications from Unipile when:
 * - Account connection status changes
 * - New messages are received
 * - New connections/relations are made
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Immediately respond 200 to acknowledge receipt
  // Process webhook asynchronously
  const event = req.body as UnipileWebhookEvent;

  console.log('Webhook received:', JSON.stringify(event));

  try {
    const supabase = getSupabaseAdmin();

    switch (event.event) {
      case 'account_status_change':
        await handleAccountStatusChange(supabase, event);
        break;

      case 'new_message':
        await handleNewMessage(supabase, event);
        break;

      case 'new_relation':
        await handleNewRelation(supabase, event);
        break;

      default:
        console.log('Unknown webhook event:', event.event);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent Unipile from retrying
    res.status(200).json({ received: true, error: 'Processing failed' });
  }
}

async function handleAccountStatusChange(supabase: ReturnType<typeof getSupabaseAdmin>, event: UnipileWebhookEvent) {
  const { account_id, status } = event;

  if (!account_id || !status) {
    console.log('Missing account_id or status in webhook');
    return;
  }

  // Map Unipile status to our status
  const mappedStatus = status === 'OK' ? 'connected' : 'disconnected';

  // Update account status
  const { error } = await supabase
    .from('unipile_accounts')
    .update({
      status: mappedStatus,
      metadata: {
        unipile_status: status,
        last_webhook: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('unipile_account_id', account_id);

  if (error) {
    console.error('Error updating account status:', error);
  } else {
    console.log(`Account ${account_id} status updated to ${mappedStatus}`);
  }
}

async function handleNewMessage(supabase: ReturnType<typeof getSupabaseAdmin>, event: UnipileWebhookEvent) {
  // Log new message event for future processing
  console.log('New message received:', event.data);

  // Could implement:
  // - Update conversation status to "replied" if inbound
  // - Send notification to user
  // - Update lead engagement score
}

async function handleNewRelation(supabase: ReturnType<typeof getSupabaseAdmin>, event: UnipileWebhookEvent) {
  // Log new connection event
  console.log('New relation:', event.data);

  // Could implement:
  // - Auto-add new connection as lead
  // - Update existing lead's connection status
  // - Trigger follow-up cadence
}
