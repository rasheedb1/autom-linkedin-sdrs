# Architectural Decisions

This document explains the key technical decisions made for Cadence Automator.

---

## 1. Why Fastify over Express/NestJS?

**Choice:** Fastify + TypeScript

### Rationale

| Aspect | Fastify | Express | NestJS |
|--------|---------|---------|--------|
| Performance | ~2-3x faster | Baseline | Similar to Express |
| TypeScript | First-class support | Requires setup | Native |
| Boilerplate | Low | Low | High |
| Plugin system | Excellent | Middleware-based | Module-based |
| Logging | Built-in Pino | Manual setup | Manual setup |

### Key Benefits

1. **Schema-based Serialization:** Fastify's JSON schema validation is faster than manual validation
2. **Plugin Architecture:** Clean dependency injection without decorators or DI containers
3. **Debugging:** Excellent error messages with stack traces
4. **Type Inference:** Better TypeScript integration than Express
5. **Native Logging:** Pino is included and optimized

### Why Not NestJS?

While NestJS offers great structure for large applications, it adds unnecessary complexity for this project:
- Decorator-heavy approach
- Complex dependency injection
- More boilerplate code
- Steeper learning curve for contributors

---

## 2. Why Supabase Auth?

**Choice:** Supabase Auth with JWT validation

### Rationale

1. **Consistency:** Same platform for authentication and database
2. **JWT Standard:** Frontend uses Supabase SDK; backend validates tokens
3. **RLS Integration:** Row Level Security policies work with `auth.uid()`
4. **Zero Custom Auth Code:** No password hashing, sessions, or token rotation
5. **Future Ready:** Can add OAuth providers later without backend changes

### How It Works

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│  Supabase Auth  │────▶│   JWT Token     │
│              │     │                 │     │                 │
└──────────────┘     └─────────────────┘     └────────┬────────┘
                                                      │
                                                      ▼
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Backend    │◀────│  Auth Middleware │◀────│  Authorization  │
│   Routes     │     │  getUser(token)  │     │  Bearer <token> │
└──────────────┘     └─────────────────┘     └─────────────────┘
```

### Implementation

```typescript
// Auth middleware validates JWT
const { data, error } = await supabase.auth.getUser(token);

// User ID is attached to request
request.user = { id: data.user.id, email: data.user.email };

// RLS policies use the same user ID
// .eq('user_id', request.user.id)
```

---

## 3. Webhook vs Callback for Unipile Account Connection

**Choice:** Implement both, prefer webhooks

### The Problem

- Unipile notifies about account connections via server-to-server webhooks
- In local development, webhooks cannot reach localhost
- Need a solution that works both locally and in production

### Solution: Dual Approach

#### Production Flow (Webhooks - Recommended)

```
┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────┐
│ Frontend │───▶│   Backend   │───▶│ Unipile  │───▶│ Webhook  │
│          │    │  /connect   │    │  Auth    │    │  POST    │
└──────────┘    └─────────────┘    └──────────┘    └──────────┘
                      │                                  │
                      │◀─────────────────────────────────┘
                      │ account_id saved via webhook
```

#### Local Development Flow (Callback + ngrok)

```
┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────┐
│ Frontend │───▶│   Backend   │───▶│ Unipile  │───▶│  ngrok   │
│          │    │  /connect   │    │  Auth    │    │  tunnel  │
└──────────┘    └─────────────┘    └──────────┘    └──────────┘
                      │                                  │
                      │◀─────────────────────────────────┘
                      │ via /auth/unipile/callback
```

### State Management

```typescript
// 1. Generate state token when starting connection
const state = randomUUID();

// 2. Store in pending_connect_sessions
await supabase.from('pending_connect_sessions').insert({
  user_id: userId,
  state: state,
  expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 min
});

// 3. Include state in callback URLs
const successRedirectUrl = `${baseUrl}/auth/unipile/callback?state=${state}`;

// 4. When webhook/callback received, look up user by state
const { data: session } = await supabase
  .from('pending_connect_sessions')
  .select('user_id')
  .eq('state', state)
  .single();

// 5. Save account connection
await supabase.from('unipile_accounts').insert({
  user_id: session.user_id,
  unipile_account_id: accountId,
});
```

### Local Setup with ngrok

```bash
# Terminal 1: Start API
npm run dev

# Terminal 2: Start ngrok tunnel
ngrok http 3001

# Update .env with ngrok URL
WEBHOOK_BASE_URL=https://abc123.ngrok.io
```

---

## 4. LinkedIn Message → InMail Fallback Strategy

**Choice:** Automatic fallback when regular message fails

### Why Fallback is Needed

| Channel | Requirement | Cost |
|---------|-------------|------|
| LinkedIn Message | Must be 1st-degree connection | Free |
| Sales Navigator InMail | Any LinkedIn user | Uses credits |

Users want to reach as many leads as possible without manual intervention.

### Implementation Logic

```typescript
async sendMessageWithFallback(params) {
  // Step 1: Try regular LinkedIn message
  try {
    const result = await unipile.sendMessage({
      account_id: accountId,
      attendees_ids: [recipientId],
      text: message,
      // No linkedin.inmail flag = regular message
    });

    return { success: true, channel: 'linkedin_message' };
  } catch (error) {
    // Check if fallback should be attempted
    if (!shouldFallbackToInMail(error)) {
      throw error;
    }
  }

  // Step 2: Fallback to InMail
  const inmailResult = await unipile.sendMessage({
    account_id: accountId,
    attendees_ids: [recipientId],
    text: message,
    linkedin: {
      api: 'sales_navigator',
      inmail: true,
    },
  });

  return { success: true, channel: 'salesnav_inmail' };
}
```

### Fallback Detection

The system triggers InMail fallback when it detects these error indicators:

```typescript
const fallbackIndicators = [
  'not connected',
  'cannot message',
  'connection required',
  'not a connection',
  'must be connected',
  'invitation required',
];

function shouldFallbackToInMail(error: UnipileError): boolean {
  // Check error code
  if (error.code === 'MESSAGING_NOT_ALLOWED') {
    return true;
  }

  // Check error message
  const message = error.message?.toLowerCase() || '';
  return fallbackIndicators.some(ind => message.includes(ind));
}
```

### Frontend Response Distinction

```json
// Regular LinkedIn message succeeded
{
  "success": true,
  "channel": "linkedin_message",
  "message": "LinkedIn message sent successfully"
}

// Fell back to InMail
{
  "success": true,
  "channel": "salesnav_inmail",
  "message": "InMail sent successfully (fallback from LinkedIn message)"
}
```

### Tracking in Database

```sql
-- execution_logs captures which channel was used
INSERT INTO execution_logs (user_id, action, lead_id, status, channel)
VALUES ('user-uuid', 'send_message', 'lead-uuid', 'success', 'salesnav_inmail');
```

This enables the frontend to:
1. Show users which channel was used
2. Count messages by channel
3. Track InMail credit consumption
4. Analyze outreach effectiveness by channel

---

## Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Fastify + TypeScript | Performance, DX, debugging |
| Auth | Supabase Auth | Consistency, RLS integration |
| HTTP Client | undici | Modern, fast, native API |
| Validation | Zod | Type-safe, excellent DX |
| Webhooks | Dual (webhook + callback) | Production + local dev support |
| Message fallback | LinkedIn → InMail | Maximize reach, clear tracking |
