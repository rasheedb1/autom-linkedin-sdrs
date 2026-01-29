import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, AuthUser } from './auth';

export interface AuthenticatedRequest extends VercelRequest {
  user: AuthUser;
}

type Handler = (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>;

interface MiddlewareOptions {
  requireAuth?: boolean;
  allowedMethods?: string[];
}

/**
 * Middleware wrapper for Vercel serverless functions
 * Handles CORS, authentication, and error handling
 */
export function withMiddleware(
  handler: Handler,
  options: MiddlewareOptions = {}
) {
  const {
    requireAuth = true,
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  } = options;

  return async (req: VercelRequest, res: VercelResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    );

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Method validation
    if (!allowedMethods.includes(req.method || '')) {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        error_code: 'METHOD_NOT_ALLOWED',
      });
    }

    // Authentication
    if (requireAuth) {
      const user = await verifyAuth(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          error_code: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication token',
        });
      }

      (req as AuthenticatedRequest).user = user;
    }

    // Execute handler with error handling
    try {
      await handler(req as AuthenticatedRequest, res);
    } catch (error) {
      console.error('Handler error:', error);

      const message = error instanceof Error ? error.message : 'Internal server error';

      res.status(500).json({
        success: false,
        error: message,
        error_code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  };
}

/**
 * Helper to create a response with standard format
 */
export function sendSuccess<T>(res: VercelResponse, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  });
}

export function sendError(
  res: VercelResponse,
  message: string,
  errorCode: string,
  status = 400
) {
  return res.status(status).json({
    success: false,
    error: message,
    error_code: errorCode,
    message,
  });
}
