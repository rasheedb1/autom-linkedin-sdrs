import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
    };
  }
}

/**
 * Authentication middleware that validates Supabase JWT tokens
 *
 * Extracts the Bearer token from Authorization header,
 * validates it with Supabase, and attaches user info to request.
 */
export function createAuthMiddleware(fastify: FastifyInstance) {
  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.status(401).send({
        success: false,
        status: 'error',
        error: 'Missing authorization header',
        error_code: 'UNAUTHORIZED',
        message: 'Authorization header is required',
        provider: 'cadence-automator',
      });
    }

    // Extract Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return reply.status(401).send({
        success: false,
        status: 'error',
        error: 'Invalid authorization format',
        error_code: 'UNAUTHORIZED',
        message: 'Authorization header must be: Bearer <token>',
        provider: 'cadence-automator',
      });
    }

    const token = parts[1];

    try {
      // Validate token with Supabase
      const { data, error } = await fastify.supabase.auth.getUser(token);

      if (error || !data.user) {
        fastify.log.warn({ error }, 'Token validation failed');
        return reply.status(401).send({
          success: false,
          status: 'error',
          error: 'Invalid or expired token',
          error_code: 'UNAUTHORIZED',
          message: 'Please log in again',
          provider: 'cadence-automator',
        });
      }

      // Attach user to request
      request.user = {
        id: data.user.id,
        email: data.user.email,
      };
    } catch (err) {
      fastify.log.error({ err }, 'Auth middleware error');
      return reply.status(500).send({
        success: false,
        status: 'error',
        error: 'Authentication service error',
        error_code: 'INTERNAL_ERROR',
        message: 'Could not validate authentication',
        provider: 'cadence-automator',
      });
    }
  };
}

/**
 * Prehandler hook for routes that require authentication
 */
export function requireAuth(fastify: FastifyInstance) {
  const authMiddleware = createAuthMiddleware(fastify);

  return {
    preHandler: authMiddleware,
  };
}
