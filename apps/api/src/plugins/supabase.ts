import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
    supabaseAdmin: SupabaseClient;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Fastify plugin that provides Supabase clients and authentication
 *
 * - supabase: Client using anon key (for user-authenticated operations)
 * - supabaseAdmin: Client using service role key (for admin operations)
 * - authenticate: Middleware to validate JWT tokens
 */
export async function supabasePlugin(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // Client for user operations (respects RLS)
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Admin client for service operations (bypasses RLS)
  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Authentication middleware
  async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.status(401).send({
        success: false,
        status: 'error',
        error: 'Missing authorization header',
        error_code: 'UNAUTHORIZED',
        message: 'Authorization header is required',
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
      });
    }

    const token = parts[1];

    try {
      // Validate token with Supabase
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        fastify.log.warn({ error }, 'Token validation failed');
        return reply.status(401).send({
          success: false,
          status: 'error',
          error: 'Invalid or expired token',
          error_code: 'UNAUTHORIZED',
          message: 'Please log in again',
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
      });
    }
  }

  // Decorate fastify instance
  fastify.decorate('supabase', supabase);
  fastify.decorate('supabaseAdmin', supabaseAdmin);
  fastify.decorate('authenticate', authenticate);

  fastify.log.info('Supabase clients initialized');
}

export default fp(supabasePlugin, {
  name: 'supabase',
});
