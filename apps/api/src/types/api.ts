// Standard API response types for frontend consistency

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  status: 'success';
  provider: 'unipile';
  request_id?: string;
  message?: string;
  data?: T;
}

export interface ApiErrorResponse {
  success: false;
  status: 'error';
  provider: 'unipile';
  error: string;
  error_code: string;
  request_id?: string;
  message: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Message-specific responses
export type MessageChannel = 'linkedin_message' | 'salesnav_inmail';

export interface SendMessageSuccessResponse extends ApiSuccessResponse {
  channel: MessageChannel;
  lead_id: string;
  linkedin_url: string;
}

export interface SendMessageErrorResponse extends ApiErrorResponse {
  channel?: MessageChannel;
  lead_id?: string;
  linkedin_url?: string;
}

export type SendMessageResponse = SendMessageSuccessResponse | SendMessageErrorResponse;

// Bulk send response
export interface SendAllResult {
  lead_id: string;
  linkedin_url: string;
  success: boolean;
  channel?: MessageChannel;
  error?: string;
  error_code?: string;
}

export interface SendAllResponse extends ApiSuccessResponse {
  total: number;
  sent: number;
  failed: number;
  linkedin_message_sent: number;
  salesnav_inmail_sent: number;
  results: SendAllResult[];
}

// Like post response
export interface LikePostSuccessResponse extends ApiSuccessResponse {
  lead_id: string;
  linkedin_url: string;
  liked_post_url: string;
}

export interface LikePostErrorResponse extends ApiErrorResponse {
  lead_id?: string;
  linkedin_url?: string;
  reason?: 'no_posts_found' | 'user_not_found' | 'reaction_failed' | 'no_account';
}

export type LikePostResponse = LikePostSuccessResponse | LikePostErrorResponse;

// Balance response
export interface BalanceResponse extends ApiSuccessResponse {
  sales_navigator_credits: number;
}

// Connect response
export interface ConnectLinkedInResponse extends ApiSuccessResponse {
  auth_url: string;
}

// Request body types
export interface SendMessageBody {
  lead_id: string;
  linkedin_url: string;
  message_body: string;
}

export interface SendAllBody {
  leads: Array<{
    lead_id: string;
    linkedin_url: string;
    first_name?: string;
    last_name?: string;
    company?: string;
  }>;
  message_template: string;
}

export interface LikePostBody {
  lead_id: string;
  linkedin_url: string;
}

// Database types
export interface Profile {
  id: string;
  email: string | null;
  created_at: string;
}

export interface UnipileAccount {
  id: string;
  user_id: string;
  provider: string;
  unipile_account_id: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  linkedin_url: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  provider_internal_id: string | null;
  created_at: string;
}

export interface ExecutionLog {
  id: string;
  user_id: string;
  action: string;
  lead_id: string | null;
  status: string;
  channel: string | null;
  request_id: string | null;
  error_code: string | null;
  raw: Record<string, unknown> | null;
  created_at: string;
}

export interface PendingConnectSession {
  id: string;
  user_id: string;
  state: string;
  provider: string;
  expires_at: string;
  created_at: string;
}
