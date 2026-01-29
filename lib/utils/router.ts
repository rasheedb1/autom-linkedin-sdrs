import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest } from '../middleware/withMiddleware';

export type RouteHandler = (
  req: AuthenticatedRequest,
  res: VercelResponse,
  params: Record<string, string>
) => Promise<void | VercelResponse | undefined>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

/**
 * Mini router for handling multiple routes in a single serverless function
 * Supports dynamic parameters like :id
 */
export class Router {
  private routes: Route[] = [];

  private parsePattern(path: string): { regex: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];

    // Replace :param with regex capture group
    const regexPattern = path.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    return {
      regex: new RegExp(`^${regexPattern}$`),
      paramNames,
    };
  }

  private addRoute(method: string, path: string, handler: RouteHandler) {
    const { regex, paramNames } = this.parsePattern(path);
    this.routes.push({
      method,
      pattern: regex,
      paramNames,
      handler,
    });
    return this;
  }

  get(path: string, handler: RouteHandler) {
    return this.addRoute('GET', path, handler);
  }

  post(path: string, handler: RouteHandler) {
    return this.addRoute('POST', path, handler);
  }

  put(path: string, handler: RouteHandler) {
    return this.addRoute('PUT', path, handler);
  }

  patch(path: string, handler: RouteHandler) {
    return this.addRoute('PATCH', path, handler);
  }

  delete(path: string, handler: RouteHandler) {
    return this.addRoute('DELETE', path, handler);
  }

  /**
   * Handle incoming request by matching against registered routes
   */
  async handle(req: AuthenticatedRequest, res: VercelResponse) {
    // Extract path from query parameter (set by Vercel for catch-all routes)
    const pathArray = req.query.path;
    let path: string;

    if (Array.isArray(pathArray)) {
      path = '/' + pathArray.join('/');
    } else if (pathArray) {
      path = '/' + pathArray;
    } else {
      path = '/';
    }

    const method = req.method || 'GET';

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = path.match(route.pattern);
      if (match) {
        // Extract parameters from match
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });

        return route.handler(req, res, params);
      }
    }

    // No route found
    res.status(404).json({
      success: false,
      error: 'Not found',
      error_code: 'NOT_FOUND',
      message: `Route ${method} ${path} not found`,
    });
  }
}
