import { getSupabaseAdmin } from '../db/supabase';
import { unipileService, UnipileError } from './unipile.service';
import { parseLinkedInIdentifier } from '../helpers/linkedin';
import { UnipileErrorCode } from '../types/unipile';

export interface LikeLastPostParams {
  userId: string;
  leadId: string;
  linkedinUrl: string;
}

export interface LikeLastPostResult {
  success: boolean;
  likedPostUrl?: string;
  requestId?: string;
  error?: string;
  errorCode?: string;
  reason?: 'no_posts_found' | 'user_not_found' | 'reaction_failed' | 'no_account';
}

/**
 * Posts Service
 *
 * Handles LinkedIn post interactions (likes, comments, etc.)
 */
export class PostsService {
  private get supabase() {
    return getSupabaseAdmin();
  }

  /**
   * Get the user's connected Unipile account ID
   */
  private async getUnipileAccountId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('unipile_accounts')
      .select('unipile_account_id')
      .eq('user_id', userId)
      .eq('provider', 'LINKEDIN')
      .eq('status', 'connected')
      .single();

    if (error || !data) {
      return null;
    }

    return data.unipile_account_id;
  }

  /**
   * Resolve LinkedIn handle to provider_internal_id
   */
  private async resolveProviderInternalId(
    handle: string,
    accountId: string
  ): Promise<string | null> {
    try {
      const { user } = await unipileService.getUserByHandle(handle, accountId);
      return user.provider_id;
    } catch (error) {
      if (error instanceof UnipileError && error.code === UnipileErrorCode.USER_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Like the most recent post from a LinkedIn user
   *
   * Flow:
   * 1. Resolve LinkedIn handle to provider_internal_id
   * 2. Get user's posts
   * 3. Find the most recent post
   * 4. Add a "like" reaction
   */
  async likeLastPost(params: LikeLastPostParams): Promise<LikeLastPostResult> {
    const { userId, linkedinUrl } = params;

    // Get user's Unipile account
    const accountId = await this.getUnipileAccountId(userId);
    if (!accountId) {
      return {
        success: false,
        error: 'No connected LinkedIn account found',
        errorCode: 'NO_ACCOUNT',
        reason: 'no_account',
      };
    }

    // Parse LinkedIn handle from URL
    const handle = parseLinkedInIdentifier(linkedinUrl);
    if (!handle) {
      return {
        success: false,
        error: 'Invalid LinkedIn URL',
        errorCode: 'INVALID_URL',
      };
    }

    // Resolve provider_internal_id
    const providerInternalId = await this.resolveProviderInternalId(handle, accountId);
    if (!providerInternalId) {
      return {
        success: false,
        error: 'Could not find LinkedIn user',
        errorCode: 'USER_NOT_FOUND',
        reason: 'user_not_found',
      };
    }

    // Get user's posts
    let posts;
    try {
      const result = await unipileService.getUserPosts(providerInternalId, accountId, { limit: 10 });
      posts = result.posts;
    } catch (error) {
      if (error instanceof UnipileError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
          requestId: error.requestId,
        };
      }
      throw error;
    }

    // Check if user has any posts
    if (!posts || posts.length === 0) {
      return {
        success: false,
        error: 'This lead has no recent posts to like',
        reason: 'no_posts_found',
      };
    }

    // Get the most recent post (assuming sorted by date, or sort ourselves)
    const sortedPosts = [...posts].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Most recent first
    });

    const latestPost = sortedPosts[0];
    const postId = latestPost.social_id || latestPost.id;

    if (!postId) {
      return {
        success: false,
        error: 'Could not identify post ID',
        errorCode: 'INVALID_POST',
        reason: 'reaction_failed',
      };
    }

    // Add like reaction
    try {
      const { requestId } = await unipileService.addReaction(postId, accountId, 'like');

      // Build post URL if available
      const likedPostUrl = latestPost.url || this.buildPostUrl(postId);

      return {
        success: true,
        likedPostUrl,
        requestId,
      };
    } catch (error) {
      if (error instanceof UnipileError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
          requestId: error.requestId,
          reason: 'reaction_failed',
        };
      }
      throw error;
    }
  }

  /**
   * Build a LinkedIn post URL from social_id
   *
   * Note: This is a best-effort reconstruction and may not always work
   */
  private buildPostUrl(socialId: string): string {
    // Extract activity ID from URN format: urn:li:activity:1234567890
    const activityMatch = socialId.match(/urn:li:activity:(\d+)/);
    if (activityMatch) {
      return `https://www.linkedin.com/feed/update/urn:li:activity:${activityMatch[1]}/`;
    }

    // If it's already a numeric ID
    if (/^\d+$/.test(socialId)) {
      return `https://www.linkedin.com/feed/update/urn:li:activity:${socialId}/`;
    }

    // Fallback: return the social_id as-is in the URL
    return `https://www.linkedin.com/feed/update/${encodeURIComponent(socialId)}/`;
  }
}

export const postsService = new PostsService();
