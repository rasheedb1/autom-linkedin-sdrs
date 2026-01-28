import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { PostsService } from '../../services/posts.service.js';
import { LoggingService } from '../../services/logging.service.js';
import type {
  LikePostBody,
  LikePostResponse,
  ApiErrorResponse,
} from '../../types/api.js';

// Request body schema
const likePostBodySchema = z.object({
  lead_id: z.string().uuid(),
  linkedin_url: z.string().url(),
});

/**
 * LinkedIn posts routes
 */
export async function linkedinPostsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const postsService = new PostsService(fastify.supabaseAdmin);
  const loggingService = new LoggingService(fastify.supabaseAdmin);

  /**
   * POST /api/linkedin/posts/like-last
   *
   * Like the most recent post from a LinkedIn user
   */
  fastify.post<{
    Body: LikePostBody;
    Reply: LikePostResponse | ApiErrorResponse;
  }>(
    '/api/linkedin/posts/like-last',
    requireAuth(fastify),
    async (request, reply) => {
      const userId = request.user!.id;

      // Validate request body
      const parseResult = likePostBodySchema.safeParse(request.body);
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

      const { lead_id, linkedin_url } = parseResult.data;

      try {
        const result = await postsService.likeLastPost({
          userId,
          leadId: lead_id,
          linkedinUrl: linkedin_url,
        });

        // Log the result
        await loggingService.logLikePost(
          userId,
          lead_id,
          result.success,
          result.errorCode,
          result.requestId
        );

        if (result.success) {
          return {
            success: true,
            status: 'success',
            lead_id,
            linkedin_url,
            liked_post_url: result.likedPostUrl!,
            provider: 'unipile',
            request_id: result.requestId,
            message: 'Like sent successfully',
          };
        }

        // Handle specific failure reasons
        if (result.reason === 'no_posts_found') {
          return reply.status(200).send({
            success: false,
            status: 'error',
            lead_id,
            linkedin_url,
            reason: 'no_posts_found',
            provider: 'unipile',
            error: result.error || 'No posts found',
            error_code: 'NO_POSTS',
            message: 'This lead has no recent posts to like',
          });
        }

        if (result.reason === 'user_not_found') {
          return reply.status(200).send({
            success: false,
            status: 'error',
            lead_id,
            linkedin_url,
            reason: 'user_not_found',
            provider: 'unipile',
            error: result.error || 'User not found',
            error_code: 'USER_NOT_FOUND',
            message: 'Could not find LinkedIn user',
          });
        }

        return reply.status(200).send({
          success: false,
          status: 'error',
          lead_id,
          linkedin_url,
          reason: result.reason,
          provider: 'unipile',
          error: result.error || 'Failed to like post',
          error_code: result.errorCode || 'LIKE_FAILED',
          request_id: result.requestId,
          message: 'Could not like post',
        });
      } catch (error) {
        fastify.log.error({ error, userId, lead_id }, 'Unexpected error liking post');

        await loggingService.logLikePost(userId, lead_id, false, 'INTERNAL_ERROR');

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

export default linkedinPostsRoutes;
