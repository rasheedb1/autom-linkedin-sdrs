import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { UnipileWebhookEvent } from '../../types/unipile.js';

// Schema for webhook payload validation
const webhookPayloadSchema = z.object({
  event: z.string(),
  account_id: z.string().optional(),
  account_type: z.string().optional(),
  status: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

/**
 * Unipile webhook routes
 */
export async function unipileWebhookRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * POST /webhooks/unipile
   *
   * Receive webhook events from Unipile
   */
  fastify.post<{
    Body: unknown;
    Querystring: { state?: string };
  }>('/webhooks/unipile', async (request, reply) => {
    fastify.log.info({ body: request.body }, 'Received Unipile webhook');

    try {
      const payload = webhookPayloadSchema.parse(request.body);

      // Handle different event types
      switch (payload.event) {
        case 'account.created':
        case 'account_connected':
        case 'account.connected':
          await handleAccountConnected(fastify, payload);
          break;

        case 'account_status_change':
        case 'account.status_changed':
          await handleAccountStatusChange(fastify, payload);
          break;

        case 'new_message':
        case 'message.created':
          // Log but don't process for now
          fastify.log.info({ event: payload.event }, 'New message event received');
          break;

        case 'new_relation':
        case 'relation.created':
          // Log but don't process for now
          fastify.log.info({ event: payload.event }, 'New relation event received');
          break;

        default:
          fastify.log.info({ event: payload.event }, 'Unhandled webhook event');
      }

      return { received: true };
    } catch (error) {
      fastify.log.error({ error, body: request.body }, 'Failed to process webhook');
      // Always return 200 to prevent Unipile from retrying
      return { received: true, error: 'Processing failed' };
    }
  });

  /**
   * GET /auth/unipile/callback
   *
   * Fallback callback for local development (redirect-based flow)
   */
  fastify.get<{
    Querystring: {
      state?: string;
      account_id?: string;
      error?: string;
    };
  }>('/auth/unipile/callback', async (request, reply) => {
    const { state, account_id, error } = request.query;

    fastify.log.info({ state, account_id, error }, 'Received callback');

    if (error) {
      // Redirect to frontend with error
      return reply.redirect(`/?linkedin_connect=error&message=Connection%20failed`);
    }

    if (!state) {
      return reply.redirect(`/?linkedin_connect=error&message=Missing%20state`);
    }

    // Look up pending session
    const { data: session, error: sessionError } = await fastify.supabaseAdmin
      .from('pending_connect_sessions')
      .select('*')
      .eq('state', state)
      .single();

    if (sessionError || !session) {
      fastify.log.warn({ state }, 'Pending session not found');
      return reply.redirect(`/?linkedin_connect=error&message=Session%20expired`);
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await fastify.supabaseAdmin
        .from('pending_connect_sessions')
        .delete()
        .eq('id', session.id);

      return reply.redirect(`/?linkedin_connect=error&message=Session%20expired`);
    }

    // If we have account_id from query params, use it
    if (account_id) {
      await saveAccountConnection(fastify, session.user_id, account_id);

      // Clean up session
      await fastify.supabaseAdmin
        .from('pending_connect_sessions')
        .delete()
        .eq('id', session.id);

      return reply.redirect(`/?linkedin_connect=success`);
    }

    // If no account_id, the webhook should handle it
    // Redirect with pending status
    return reply.redirect(`/?linkedin_connect=pending`);
  });
}

/**
 * Handle account connected event
 */
async function handleAccountConnected(
  fastify: FastifyInstance,
  payload: z.infer<typeof webhookPayloadSchema>
): Promise<void> {
  const accountId = payload.account_id || (payload.data?.account_id as string);

  if (!accountId) {
    fastify.log.warn({ payload }, 'Account connected event missing account_id');
    return;
  }

  // Try to find associated user from data or recent pending sessions
  // This is a simplified approach - in production you might have more context
  const { data: sessions } = await fastify.supabaseAdmin
    .from('pending_connect_sessions')
    .select('*')
    .eq('provider', 'LINKEDIN')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (sessions && sessions.length > 0) {
    const session = sessions[0];
    await saveAccountConnection(fastify, session.user_id, accountId);

    // Clean up session
    await fastify.supabaseAdmin
      .from('pending_connect_sessions')
      .delete()
      .eq('id', session.id);

    fastify.log.info({ userId: session.user_id, accountId }, 'Account connected via webhook');
  } else {
    fastify.log.warn({ accountId }, 'No pending session found for account connection');
  }
}

/**
 * Handle account status change event
 */
async function handleAccountStatusChange(
  fastify: FastifyInstance,
  payload: z.infer<typeof webhookPayloadSchema>
): Promise<void> {
  const accountId = payload.account_id;
  const newStatus = payload.status || (payload.data?.status as string);

  if (!accountId || !newStatus) {
    fastify.log.warn({ payload }, 'Status change event missing data');
    return;
  }

  // Update account status in database
  const { error } = await fastify.supabaseAdmin
    .from('unipile_accounts')
    .update({
      status: newStatus === 'OK' ? 'connected' : 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('unipile_account_id', accountId);

  if (error) {
    fastify.log.error({ error, accountId, newStatus }, 'Failed to update account status');
  } else {
    fastify.log.info({ accountId, newStatus }, 'Account status updated');
  }
}

/**
 * Save account connection to database
 */
async function saveAccountConnection(
  fastify: FastifyInstance,
  userId: string,
  accountId: string
): Promise<void> {
  const { error } = await fastify.supabaseAdmin
    .from('unipile_accounts')
    .upsert({
      user_id: userId,
      provider: 'LINKEDIN',
      unipile_account_id: accountId,
      status: 'connected',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    });

  if (error) {
    fastify.log.error({ error, userId, accountId }, 'Failed to save account connection');
    throw error;
  }
}

export default unipileWebhookRoutes;
