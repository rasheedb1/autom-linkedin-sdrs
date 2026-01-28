import { request } from 'undici';
import { env } from '../config/env.js';
import {
  UnipileErrorCode,
  type UnipileUser,
  type UnipilePost,
  type SendMessageRequest,
  type SendMessageResponse,
  type AddReactionRequest,
  type HostedLinkRequest,
  type HostedLinkResponse,
  type UnipileErrorResponse,
  type UnipileAccount,
} from '../types/unipile.js';

/**
 * Error thrown by Unipile API operations
 */
export class UnipileError extends Error {
  constructor(
    message: string,
    public code: UnipileErrorCode | string,
    public statusCode: number,
    public requestId?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'UnipileError';
  }
}

/**
 * Unipile API Service
 *
 * Handles all interactions with the Unipile API for LinkedIn automation.
 */
export class UnipileService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = env.UNIPILE_BASE_URL;
    this.apiKey = env.UNIPILE_API_KEY;
  }

  /**
   * Make an authenticated request to Unipile API
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<{ data: T; requestId?: string }> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'X-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
    };

    try {
      const response = await request(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const requestId = response.headers['x-request-id'] as string | undefined;
      const contentType = response.headers['content-type'] as string | undefined;

      // Check for HTML response (usually indicates auth error)
      if (contentType?.includes('text/html')) {
        throw new UnipileError(
          'Received HTML response - likely unauthorized',
          UnipileErrorCode.UNAUTHORIZED,
          response.statusCode,
          requestId
        );
      }

      const responseBody = await response.body.json() as T | UnipileErrorResponse;

      // Handle error responses
      if (response.statusCode >= 400) {
        const errorBody = responseBody as UnipileErrorResponse;
        const errorCode = this.mapStatusToErrorCode(response.statusCode, errorBody);

        throw new UnipileError(
          errorBody.detail || errorBody.title || 'Unipile API error',
          errorCode,
          response.statusCode,
          requestId,
          errorBody
        );
      }

      return { data: responseBody as T, requestId };
    } catch (error) {
      if (error instanceof UnipileError) {
        throw error;
      }

      // Handle network errors
      throw new UnipileError(
        error instanceof Error ? error.message : 'Network error',
        UnipileErrorCode.UNKNOWN_ERROR,
        0
      );
    }
  }

  /**
   * Map HTTP status code to error code
   */
  private mapStatusToErrorCode(status: number, errorBody?: UnipileErrorResponse): UnipileErrorCode {
    switch (status) {
      case 401:
        return UnipileErrorCode.UNAUTHORIZED;
      case 429:
        return UnipileErrorCode.RATE_LIMIT;
      case 400:
        // Check for specific messaging errors
        if (errorBody?.detail?.toLowerCase().includes('not connected') ||
            errorBody?.detail?.toLowerCase().includes('cannot message')) {
          return UnipileErrorCode.MESSAGING_NOT_ALLOWED;
        }
        return UnipileErrorCode.INVALID_PARAMETERS;
      case 404:
        if (errorBody?.type?.includes('user')) {
          return UnipileErrorCode.USER_NOT_FOUND;
        }
        if (errorBody?.type?.includes('post')) {
          return UnipileErrorCode.POST_NOT_FOUND;
        }
        return UnipileErrorCode.INVALID_PARAMETERS;
      case 503:
      case 504:
        return UnipileErrorCode.SERVICE_UNAVAILABLE;
      default:
        return UnipileErrorCode.UNKNOWN_ERROR;
    }
  }

  // ============================================
  // Account Management
  // ============================================

  /**
   * Create a hosted authentication link for LinkedIn
   */
  async createHostedAuthLink(options: {
    notifyUrl?: string;
    successRedirectUrl?: string;
    failureRedirectUrl?: string;
    name?: string;
  }): Promise<{ authUrl: string; requestId?: string }> {
    const body: HostedLinkRequest = {
      type: 'LINKEDIN',
      notify_url: options.notifyUrl,
      success_redirect_url: options.successRedirectUrl,
      failure_redirect_url: options.failureRedirectUrl,
      name: options.name,
    };

    const { data, requestId } = await this.makeRequest<HostedLinkResponse>(
      'POST',
      '/api/v1/hosted/link',
      body
    );

    return { authUrl: data.url, requestId };
  }

  /**
   * List all connected accounts
   */
  async listAccounts(options?: {
    cursor?: string;
    limit?: number;
  }): Promise<{ accounts: UnipileAccount[]; cursor: string | null; requestId?: string }> {
    const params = new URLSearchParams();
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.limit) params.set('limit', String(options.limit));

    const queryString = params.toString();
    const path = `/api/v1/accounts${queryString ? `?${queryString}` : ''}`;

    const { data, requestId } = await this.makeRequest<{ items: UnipileAccount[]; cursor: string | null }>(
      'GET',
      path
    );

    return { accounts: data.items || [], cursor: data.cursor, requestId };
  }

  /**
   * Get a specific account by ID
   */
  async getAccount(accountId: string): Promise<{ account: UnipileAccount; requestId?: string }> {
    const { data, requestId } = await this.makeRequest<UnipileAccount>(
      'GET',
      `/api/v1/accounts/${accountId}`
    );

    return { account: data, requestId };
  }

  // ============================================
  // User Operations
  // ============================================

  /**
   * Get user by LinkedIn public identifier (handle)
   *
   * @param handle LinkedIn handle (e.g., "john-doe")
   * @param accountId The connected account ID to use
   */
  async getUserByHandle(
    handle: string,
    accountId: string
  ): Promise<{ user: UnipileUser; requestId?: string }> {
    const { data, requestId } = await this.makeRequest<UnipileUser>(
      'GET',
      `/api/v1/users/${encodeURIComponent(handle)}?account_id=${encodeURIComponent(accountId)}`
    );

    return { user: data, requestId };
  }

  // ============================================
  // Messaging
  // ============================================

  /**
   * Send a LinkedIn message (regular or InMail)
   */
  async sendMessage(params: {
    accountId: string;
    recipientId: string; // provider_internal_id
    text: string;
    inmail?: boolean;
  }): Promise<{ chatId?: string; messageId?: string; requestId?: string }> {
    const body: SendMessageRequest = {
      account_id: params.accountId,
      text: params.text,
      attendees_ids: [params.recipientId],
    };

    // Add InMail configuration if requested
    if (params.inmail) {
      body.linkedin = {
        api: 'sales_navigator',
        inmail: true,
      };
    }

    const { data, requestId } = await this.makeRequest<SendMessageResponse>(
      'POST',
      '/api/v1/chats',
      body
    );

    return {
      chatId: data.chat_id,
      messageId: data.message_id,
      requestId: requestId || data.request_id,
    };
  }

  // ============================================
  // Posts & Reactions
  // ============================================

  /**
   * Get posts for a user
   *
   * @param providerInternalId The user's provider_internal_id
   * @param accountId The connected account ID
   */
  async getUserPosts(
    providerInternalId: string,
    accountId: string,
    options?: { limit?: number }
  ): Promise<{ posts: UnipilePost[]; requestId?: string }> {
    const params = new URLSearchParams();
    params.set('account_id', accountId);
    if (options?.limit) params.set('limit', String(options.limit));

    const { data, requestId } = await this.makeRequest<{ items: UnipilePost[] }>(
      'GET',
      `/api/v1/users/${encodeURIComponent(providerInternalId)}/posts?${params.toString()}`
    );

    return { posts: data.items || [], requestId };
  }

  /**
   * Add a reaction (like) to a post
   *
   * @param postId The post's social_id (e.g., urn:li:activity:xxx)
   * @param accountId The connected account ID
   * @param reactionType Type of reaction (default: 'like')
   */
  async addReaction(
    postId: string,
    accountId: string,
    reactionType: AddReactionRequest['reaction_type'] = 'like'
  ): Promise<{ requestId?: string }> {
    const body: AddReactionRequest = {
      account_id: accountId,
      reaction_type: reactionType,
    };

    const { requestId } = await this.makeRequest<unknown>(
      'POST',
      `/api/v1/posts/${encodeURIComponent(postId)}/reactions`,
      body
    );

    return { requestId };
  }

  // ============================================
  // Sales Navigator
  // ============================================

  /**
   * Get InMail credits balance
   */
  async getInMailCredits(accountId: string): Promise<{ credits: number; requestId?: string }> {
    const { data, requestId } = await this.makeRequest<{ credits?: number; inmail_credits?: number }>(
      'GET',
      `/api/v1/linkedin/inmail-credits?account_id=${encodeURIComponent(accountId)}`
    );

    // Handle different possible response formats
    const credits = data.credits ?? data.inmail_credits ?? 0;

    return { credits, requestId };
  }

  // ============================================
  // Webhooks
  // ============================================

  /**
   * Create a webhook subscription
   */
  async createWebhook(
    url: string,
    events: string[]
  ): Promise<{ webhookId: string; requestId?: string }> {
    const { data, requestId } = await this.makeRequest<{ id: string }>(
      'POST',
      '/api/v1/webhooks',
      { url, events }
    );

    return { webhookId: data.id, requestId };
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<{ requestId?: string }> {
    const { requestId } = await this.makeRequest<unknown>(
      'DELETE',
      `/api/v1/webhooks/${webhookId}`
    );

    return { requestId };
  }
}

// Export singleton instance
export const unipileService = new UnipileService();
