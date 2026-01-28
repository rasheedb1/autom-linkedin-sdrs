# Cadence Automator

Backend API for LinkedIn/Sales Navigator automation using the Unipile API.

## Features

- **LinkedIn Connection:** Connect LinkedIn/Sales Navigator accounts via Unipile hosted auth
- **Message Sending:** Send LinkedIn messages with automatic InMail fallback
- **Bulk Operations:** Send messages to multiple leads with template support
- **Post Engagement:** Like the most recent post from any LinkedIn user
- **Credits Tracking:** Check Sales Navigator InMail credit balance
- **Execution Logging:** Track all actions for analytics

## Tech Stack

- **Framework:** Fastify + TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (JWT)
- **LinkedIn Integration:** Unipile API
- **Validation:** Zod

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project
- Unipile API key

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd cadence-automator

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Configuration

Edit `.env` with your credentials:

```env
# Server
PORT=3001

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Unipile
UNIPILE_API_KEY=your-unipile-api-key
UNIPILE_BASE_URL=https://api28.unipile.com:15873

# Webhooks (for local dev, use ngrok URL)
WEBHOOK_BASE_URL=http://localhost:3001
```

### Database Setup

Run the migration in your Supabase SQL editor:

```bash
# The migration file is at:
supabase/migrations/001_initial_schema.sql
```

### Running Locally

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/ready` | GET | Ready check (includes DB) |

### LinkedIn Connection

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/unipile/connect/linkedin` | POST | Yes | Start LinkedIn connection flow |
| `/api/unipile/status` | GET | Yes | Check connection status |
| `/api/unipile/disconnect` | DELETE | Yes | Disconnect LinkedIn account |

### Messaging

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/linkedin/message/send` | POST | Yes | Send message to single lead |
| `/api/linkedin/message/send-all` | POST | Yes | Send messages to multiple leads |

### Posts

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/linkedin/posts/like-last` | POST | Yes | Like user's most recent post |

### Sales Navigator

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/linkedin/salesnav/balance` | GET | Yes | Get InMail credits balance |

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks/unipile` | POST | Receive Unipile events |
| `/auth/unipile/callback` | GET | OAuth callback (local dev) |

## Usage Examples

### Authentication

All authenticated endpoints require a Supabase JWT token:

```bash
# Get token from Supabase Auth
curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password"}'
```

### Connect LinkedIn

```bash
curl -X POST http://localhost:3001/api/unipile/connect/linkedin \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'

# Response:
# {
#   "success": true,
#   "status": "success",
#   "auth_url": "https://...",
#   "message": "LinkedIn connection initiated"
# }
```

### Send Message

```bash
curl -X POST http://localhost:3001/api/linkedin/message/send \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "lead_id": "uuid-of-lead",
    "linkedin_url": "https://linkedin.com/in/john-doe",
    "message_body": "Hola {{nombre}}, me gustaría conectar contigo."
  }'

# Response (LinkedIn message):
# {
#   "success": true,
#   "status": "success",
#   "channel": "linkedin_message",
#   "message": "LinkedIn message sent successfully"
# }

# Response (InMail fallback):
# {
#   "success": true,
#   "status": "success",
#   "channel": "salesnav_inmail",
#   "message": "InMail sent successfully (fallback from LinkedIn message)"
# }
```

### Send Bulk Messages

```bash
curl -X POST http://localhost:3001/api/linkedin/message/send-all \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "leads": [
      {"lead_id": "uuid-1", "linkedin_url": "https://linkedin.com/in/user1", "first_name": "John"},
      {"lead_id": "uuid-2", "linkedin_url": "https://linkedin.com/in/user2", "first_name": "Jane"}
    ],
    "message_template": "Hola {{nombre}}, ¿cómo estás?"
  }'

# Response:
# {
#   "success": true,
#   "total": 2,
#   "sent": 2,
#   "failed": 0,
#   "linkedin_message_sent": 1,
#   "salesnav_inmail_sent": 1,
#   "results": [...]
# }
```

### Like Last Post

```bash
curl -X POST http://localhost:3001/api/linkedin/posts/like-last \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "lead_id": "uuid-of-lead",
    "linkedin_url": "https://linkedin.com/in/john-doe"
  }'

# Response:
# {
#   "success": true,
#   "liked_post_url": "https://linkedin.com/feed/update/urn:li:activity:123",
#   "message": "Like sent successfully"
# }
```

### Get Credits Balance

```bash
curl -X GET http://localhost:3001/api/linkedin/salesnav/balance \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'

# Response:
# {
#   "success": true,
#   "sales_navigator_credits": 148,
#   "message": "Sales Navigator credits: 148"
# }
```

## Template Placeholders

Supported placeholders in message templates:

| Placeholder | Description | Fallback |
|-------------|-------------|----------|
| `{{nombre}}` | First name (Spanish) | Handle → "there" |
| `{{first_name}}` | First name | Handle → "there" |
| `{{last_name}}` | Last name | Empty |
| `{{company}}` | Company name | Empty |
| `{{full_name}}` | Full name | First name fallback |

## Local Development with ngrok

For webhook testing locally:

```bash
# Terminal 1: Start the API
npm run dev

# Terminal 2: Start ngrok
ngrok http 3001

# Copy the ngrok URL and update .env
WEBHOOK_BASE_URL=https://abc123.ngrok.io

# Restart the API
```

## Project Structure

```
cadence-automator/
├── apps/api/
│   ├── src/
│   │   ├── config/env.ts         # Environment config
│   │   ├── plugins/supabase.ts   # Supabase client
│   │   ├── middleware/auth.ts    # JWT validation
│   │   ├── services/
│   │   │   ├── unipile.service.ts   # Unipile API wrapper
│   │   │   ├── message.service.ts   # Messaging logic
│   │   │   ├── posts.service.ts     # Posts logic
│   │   │   └── logging.service.ts   # Execution logs
│   │   ├── helpers/
│   │   │   ├── linkedin.ts       # URL parsing
│   │   │   └── template.ts       # Template rendering
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── unipile/
│   │   │   │   ├── connect.ts
│   │   │   │   └── webhook.ts
│   │   │   └── linkedin/
│   │   │       ├── message.ts
│   │   │       ├── posts.ts
│   │   │       └── salesnav.ts
│   │   ├── types/
│   │   │   ├── api.ts            # API response types
│   │   │   └── unipile.ts        # Unipile types
│   │   └── index.ts              # Entry point
│   └── package.json
├── supabase/migrations/
│   └── 001_initial_schema.sql
├── docs/decisions.md             # Architecture decisions
└── README.md
```

## Error Handling

All endpoints return consistent JSON responses:

```typescript
// Success
{
  "success": true,
  "status": "success",
  "provider": "unipile",
  ...data
}

// Error
{
  "success": false,
  "status": "error",
  "error": "Error description",
  "error_code": "ERROR_CODE",
  "message": "User-friendly message",
  "provider": "unipile"
}
```

## License

MIT
