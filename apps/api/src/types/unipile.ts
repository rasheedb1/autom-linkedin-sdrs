// Unipile API types based on documentation

export interface UnipileUser {
  id?: string;
  provider_id: string; // provider_internal_id
  provider_public_id?: string; // LinkedIn handle
  full_name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  profile_picture_url?: string;
  profile_url?: string;
}

export interface UnipilePost {
  id: string;
  social_id: string; // urn:li:activity:xxx
  text?: string;
  author?: UnipileUser;
  created_at?: string;
  likes_count?: number;
  comments_count?: number;
  url?: string;
}

export interface UnipileChat {
  id: string;
  account_id: string;
  attendees: UnipileUser[];
  messages?: UnipileMessage[];
}

export interface UnipileMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  attachments?: unknown[];
}

export interface UnipileAccount {
  id: string;
  type: 'LINKEDIN' | 'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'TELEGRAM';
  status: 'OK' | 'CONNECTING' | 'CREDENTIALS' | 'STOPPED' | 'ERROR' | 'PERMISSIONS';
  created_on?: string;
}

// Request types
export interface SendMessageRequest {
  account_id: string;
  text: string;
  attendees_ids: string[];
  linkedin?: {
    api?: 'classic' | 'recruiter' | 'sales_navigator';
    inmail?: boolean;
  };
}

export interface AddReactionRequest {
  account_id: string;
  reaction_type: 'like' | 'celebrate' | 'support' | 'love' | 'insightful' | 'funny';
}

export interface HostedLinkRequest {
  type: 'LINKEDIN';
  api_url?: string;
  expiresOn?: string;
  notify_url?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
  name?: string;
}

export interface HostedLinkResponse {
  object: string;
  url: string;
}

// Response types
export interface UnipileApiResponse<T> {
  object?: string;
  items?: T[];
  cursor?: string | null;
  data?: T;
}

export interface UnipileErrorResponse {
  title?: string;
  detail?: string;
  type?: string;
  status?: number;
}

export interface SendMessageResponse {
  object: string;
  chat_id?: string;
  message_id?: string;
  request_id?: string;
}

// Webhook event types
export interface UnipileWebhookEvent {
  event: 'account_status_change' | 'new_message' | 'new_relation';
  account_id: string;
  account_type?: string;
  data?: Record<string, unknown>;
}

export interface AccountStatusChangeEvent extends UnipileWebhookEvent {
  event: 'account_status_change';
  status: string;
  previous_status?: string;
}

export interface NewRelationEvent extends UnipileWebhookEvent {
  event: 'new_relation';
  user_full_name?: string;
  user_provider_id?: string;
  user_public_identifier?: string;
}

// Unipile error codes
export enum UnipileErrorCode {
  UNAUTHORIZED = 'UNIPILE_UNAUTHORIZED',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MESSAGING_NOT_ALLOWED = 'MESSAGING_NOT_ALLOWED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  POST_NOT_FOUND = 'POST_NOT_FOUND',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
