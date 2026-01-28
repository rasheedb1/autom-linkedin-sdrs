import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { requireAuth } from '../../middleware/auth.js';
import { unipileService, UnipileError } from '../../services/unipile.service.js';
import { LoggingService } from '../../services/logging.service.js';
import type { BalanceResponse, ApiErrorResponse } from '../../types/api.js';

/**
 * LinkedIn Sales Navigator routes
 */
export async function linkedinSalesnavRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const loggingService = new LoggingService(fastify.supabaseAdmin);

  /**
   * GET /api/linkedin/salesnav/balance
   *
   * Get Sales Navigator InMail credits balance
   */
  fastify.get<{
    Reply: BalanceResponse | ApiErrorResponse;
  }>(
    '/api/linkedin/salesnav/balance',
    requireAuth(fastify),
    async (request, reply) => {
      const userId = request.user!.id;

      try {
        // Get user's Unipile account
        const { data: account, error: accountError } = await fastify.supabaseAdmin
          .from('unipile_accounts')
          .select('unipile_account_id')
          .eq('user_id', userId)
          .eq('provider', 'LINKEDIN')
          .eq('status', 'connected')
          .single();

        if (accountError || !account) {
          await loggingService.logBalanceCheck(userId, false, undefined, 'NO_ACCOUNT');
          return reply.status(200).send({
            success: false,
            status: 'error',
            error: 'No connected LinkedIn account found',
            error_code: 'NO_ACCOUNT',
            message: 'Please connect your LinkedIn account first',
            provider: 'unipile',
          });
        }

        // Get InMail credits from Unipile
        const { credits, requestId } = await unipileService.getInMailCredits(
          account.unipile_account_id
        );

        await loggingService.logBalanceCheck(userId, true, credits);

        return {
          success: true,
          status: 'success',
          provider: 'unipile',
          sales_navigator_credits: credits,
          request_id: requestId,
          message: `Sales Navigator credits: ${credits}`,
        };
      } catch (error) {
        fastify.log.error({ error, userId }, 'Failed to get InMail credits');

        if (error instanceof UnipileError) {
          await loggingService.logBalanceCheck(userId, false, undefined, error.code);
          return reply.status(200).send({
            success: false,
            status: 'error',
            error: error.message,
            error_code: error.code,
            request_id: error.requestId,
            message: 'Failed to retrieve Sales Navigator balance',
            provider: 'unipile',
          });
        }

        await loggingService.logBalanceCheck(userId, false, undefined, 'INTERNAL_ERROR');
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
}

export default linkedinSalesnavRoutes;
