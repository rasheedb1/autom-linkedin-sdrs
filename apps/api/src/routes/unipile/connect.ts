import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireAuth } from '../../middleware/auth.js';
import { unipileService, UnipileError } from '../../services/unipile.service.js';
import { LoggingService } from '../../services/logging.service.js';
import { env } from '../../config/env.js';
import type { ConnectLinkedInResponse, ApiErrorResponse } from '../../types/api.js';

/**
 * Unipile connection routes
 */
export async function unipileConnectRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const loggingService = new LoggingService(fastify.supabaseAdmin);

  /**
   * POST /api/unipile/connect/linkedin
   *
   * Start LinkedIn connection flow via Unipile hosted auth
   */
  fastify.post<{
    Reply: ConnectLinkedInResponse | ApiErrorResponse;
  }>(
    '/api/unipile/connect/linkedin',
    requireAuth(fastify),
    async (request, reply) => {
      const userId = request.user!.id;

      try {
        // Generate unique state token
        const state = randomUUID();

        // Store pending session
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        const { error: insertError } = await fastify.supabaseAdmin
          .from('pending_connect_sessions')
          .insert({
            user_id: userId,
            state,
            provider: 'LINKEDIN',
            expires_at: expiresAt.toISOString(),
          });

        if (insertError) {
          fastify.log.error({ error: insertError }, 'Failed to create pending session');
          return reply.status(500).send({
            success: false,
            status: 'error',
            error: 'Failed to initialize connection',
            error_code: 'SESSION_CREATE_FAILED',
            message: 'Could not start LinkedIn connection process',
            provider: 'unipile',
          });
        }

        // Build callback URLs
        const baseUrl = env.WEBHOOK_BASE_URL || `http://localhost:${env.PORT}`;
        const successRedirectUrl = `${baseUrl}/auth/unipile/callback?state=${state}`;
        const failureRedirectUrl = `${baseUrl}/auth/unipile/callback?state=${state}&error=true`;
        const notifyUrl = `${baseUrl}/webhooks/unipile`;

        // Create hosted auth link
        const { authUrl, requestId } = await unipileService.createHostedAuthLink({
          notifyUrl,
          successRedirectUrl,
          failureRedirectUrl,
          name: `user-${userId.slice(0, 8)}`,
        });

        fastify.log.info({ userId, requestId }, 'LinkedIn connection initiated');

        return {
          success: true,
          status: 'success',
          auth_url: authUrl,
          provider: 'unipile',
          request_id: requestId,
          message: 'LinkedIn connection initiated',
        };
      } catch (error) {
        fastify.log.error({ error, userId }, 'Failed to create auth link');

        if (error instanceof UnipileError) {
          return reply.status(200).send({
            success: false,
            status: 'error',
            error: error.message,
            error_code: error.code,
            message: 'Failed to start LinkedIn connection',
            provider: 'unipile',
            request_id: error.requestId,
          });
        }

        return reply.status(500).send({
          success: false,
          status: 'error',
          error: 'Internal server error',
          error_code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          provider: 'unipile',
        });
      }
    }
  );

  /**
   * GET /api/unipile/status
   *
   * Check if user has a connected LinkedIn account
   */
  fastify.get(
    '/api/unipile/status',
    requireAuth(fastify),
    async (request, _reply) => {
      const userId = request.user!.id;

      const { data, error } = await fastify.supabaseAdmin
        .from('unipile_accounts')
        .select('id, provider, status, created_at, updated_at')
        .eq('user_id', userId)
        .eq('provider', 'LINKEDIN')
        .single();

      if (error || !data) {
        return {
          success: true,
          status: 'success',
          connected: false,
          provider: 'unipile',
          message: 'No LinkedIn account connected',
        };
      }

      return {
        success: true,
        status: 'success',
        connected: true,
        account_status: data.status,
        connected_at: data.created_at,
        provider: 'unipile',
        message: 'LinkedIn account is connected',
      };
    }
  );

  /**
   * DELETE /api/unipile/disconnect
   *
   * Disconnect LinkedIn account
   */
  fastify.delete(
    '/api/unipile/disconnect',
    requireAuth(fastify),
    async (request, reply) => {
      const userId = request.user!.id;

      const { error } = await fastify.supabaseAdmin
        .from('unipile_accounts')
        .delete()
        .eq('user_id', userId)
        .eq('provider', 'LINKEDIN');

      if (error) {
        fastify.log.error({ error, userId }, 'Failed to disconnect account');
        return reply.status(500).send({
          success: false,
          status: 'error',
          error: 'Failed to disconnect account',
          error_code: 'DISCONNECT_FAILED',
          message: 'Could not disconnect LinkedIn account',
          provider: 'unipile',
        });
      }

      return {
        success: true,
        status: 'success',
        provider: 'unipile',
        message: 'LinkedIn account disconnected',
      };
    }
  );
}

export default unipileConnectRoutes;
