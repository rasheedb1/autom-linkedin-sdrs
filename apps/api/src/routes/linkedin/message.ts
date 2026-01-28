import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { MessageService } from '../../services/message.service.js';
import { LoggingService } from '../../services/logging.service.js';
import type {
  SendMessageBody,
  SendAllBody,
  SendMessageResponse,
  SendAllResponse,
  ApiErrorResponse,
} from '../../types/api.js';

// Request body schemas
const sendMessageBodySchema = z.object({
  lead_id: z.string().uuid(),
  linkedin_url: z.string().url(),
  message_body: z.string().min(1).max(3000),
});

const sendAllBodySchema = z.object({
  leads: z.array(z.object({
    lead_id: z.string().uuid(),
    linkedin_url: z.string().url(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    company: z.string().optional(),
  })).min(1).max(100),
  message_template: z.string().min(1).max(3000),
});

/**
 * LinkedIn messaging routes
 */
export async function linkedinMessageRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const messageService = new MessageService(fastify.supabaseAdmin);
  const loggingService = new LoggingService(fastify.supabaseAdmin);

  /**
   * POST /api/linkedin/message/send
   *
   * Send a LinkedIn message to a single lead (with InMail fallback)
   */
  fastify.post<{
    Body: SendMessageBody;
    Reply: SendMessageResponse | ApiErrorResponse;
  }>(
    '/api/linkedin/message/send',
    requireAuth(fastify),
    async (request, reply) => {
      const userId = request.user!.id;

      // Validate request body
      const parseResult = sendMessageBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          status: 'error',
          error: 'Invalid request body',
          error_code: 'VALIDATION_ERROR',
          message: parseResult.error.errors.map(e => e.message).join(', '),
          provider: 'unipile',
        });
      }

      const { lead_id, linkedin_url, message_body } = parseResult.data;

      try {
        const result = await messageService.sendMessageWithFallback({
          userId,
          leadId: lead_id,
          linkedinUrl: linkedin_url,
          messageBody: message_body,
        });

        // Log the result
        if (result.success && result.channel) {
          await loggingService.logMessageSent(userId, lead_id, result.channel, result.requestId);
        } else {
          await loggingService.logMessageFailed(
            userId,
            lead_id,
            result.errorCode || 'UNKNOWN',
            result.channel,
            result.requestId
          );
        }

        if (result.success) {
          return {
            success: true,
            status: 'success',
            channel: result.channel!,
            lead_id,
            linkedin_url,
            provider: 'unipile',
            request_id: result.requestId,
            message: result.channel === 'linkedin_message'
              ? 'LinkedIn message sent successfully'
              : 'InMail sent successfully (fallback from LinkedIn message)',
          };
        }

        return reply.status(200).send({
          success: false,
          status: 'error',
          channel: result.channel,
          lead_id,
          linkedin_url,
          provider: 'unipile',
          error: result.error || 'Failed to send message',
          error_code: result.errorCode || 'SEND_FAILED',
          request_id: result.requestId,
          message: 'Could not send message',
        });
      } catch (error) {
        fastify.log.error({ error, userId, lead_id }, 'Unexpected error sending message');

        await loggingService.logMessageFailed(userId, lead_id, 'INTERNAL_ERROR');

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
   * POST /api/linkedin/message/send-all
   *
   * Send messages to multiple leads (bulk operation)
   */
  fastify.post<{
    Body: SendAllBody;
    Reply: SendAllResponse | ApiErrorResponse;
  }>(
    '/api/linkedin/message/send-all',
    requireAuth(fastify),
    async (request, reply) => {
      const userId = request.user!.id;

      // Validate request body
      const parseResult = sendAllBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          status: 'error',
          error: 'Invalid request body',
          error_code: 'VALIDATION_ERROR',
          message: parseResult.error.errors.map(e => e.message).join(', '),
          provider: 'unipile',
        });
      }

      const { leads, message_template } = parseResult.data;

      try {
        fastify.log.info({ userId, leadCount: leads.length }, 'Starting bulk send');

        const result = await messageService.sendAll(userId, leads, message_template);

        // Log bulk operation
        await loggingService.logBulkSend(userId, {
          total: result.total,
          sent: result.sent,
          failed: result.failed,
          linkedinMessageSent: result.linkedinMessageSent,
          salesnavInmailSent: result.salesnavInmailSent,
        });

        fastify.log.info({
          userId,
          total: result.total,
          sent: result.sent,
          failed: result.failed,
        }, 'Bulk send completed');

        return {
          success: true,
          status: 'success',
          provider: 'unipile',
          total: result.total,
          sent: result.sent,
          failed: result.failed,
          linkedin_message_sent: result.linkedinMessageSent,
          salesnav_inmail_sent: result.salesnavInmailSent,
          results: result.results,
          message: `Sent ${result.sent}/${result.total} messages`,
        };
      } catch (error) {
        fastify.log.error({ error, userId }, 'Unexpected error in bulk send');

        return reply.status(500).send({
          success: false,
          status: 'error',
          error: 'Internal server error',
          error_code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during bulk send',
          provider: 'unipile',
        });
      }
    }
  );
}

export default linkedinMessageRoutes;
