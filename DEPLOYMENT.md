# Deployment Guide - Cadence Automator

## Architecture Overview

```
Users → Vercel (Frontend) → Railway (Backend API) → Supabase + Unipile
```

| Component | Platform | Purpose |
|-----------|----------|---------|
| Frontend | Vercel | React app with CDN |
| Backend | Railway | Fastify API server |
| Database | Supabase | PostgreSQL + Auth |
| LinkedIn | Unipile | API integration |

---

## Step 1: Push to GitHub

Make sure your code is pushed to a GitHub repository:

```bash
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

---

## Step 2: Deploy Backend to Railway

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### 2.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `cadence-automator` repository

### 2.3 Configure Service
- **Root Directory:** `apps/api`
- Railway will auto-detect the `railway.toml` configuration

### 2.4 Set Environment Variables
In Railway dashboard → Variables, add:

```
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
UNIPILE_API_KEY=your-unipile-key
UNIPILE_BASE_URL=https://api28.unipile.com:15873
WEBHOOK_BASE_URL=<your-railway-url>
FRONTEND_URL=<your-vercel-url>
```

### 2.5 Get Your Railway URL
After deployment, Railway generates a URL like:
`https://cadence-api-production.up.railway.app`

Update `WEBHOOK_BASE_URL` with this URL.

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub

### 3.2 Import Project
1. Click "Add New Project"
2. Import your `cadence-automator` repository

### 3.3 Configure Project
- **Framework Preset:** Vite (auto-detected)
- **Root Directory:** `apps/web`
- Vercel will auto-detect the `vercel.json` configuration

### 3.4 Set Environment Variables
In Vercel dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=https://your-railway-url.up.railway.app
```

### 3.5 Deploy
Click "Deploy" and wait for the build to complete.

---

## Step 4: Update Cross-References

After both deployments:

1. **In Railway:** Update `FRONTEND_URL` with your Vercel URL
2. **In Railway:** Update `WEBHOOK_BASE_URL` with your Railway URL

---

## Step 5: Verify Deployment

### Health Check
```bash
curl https://your-railway-url.up.railway.app/health
# Expected: {"status":"ok"}
```

### Ready Check (includes database)
```bash
curl https://your-railway-url.up.railway.app/ready
# Expected: {"status":"ok","database":"connected"}
```

### Frontend
Visit your Vercel URL and:
1. Sign up / Log in
2. Create a test lead
3. Connect LinkedIn account

---

## Environment Variables Reference

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (3001) |
| `NODE_ENV` | Yes | `production` |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (secret) |
| `UNIPILE_API_KEY` | Yes | Unipile API key |
| `UNIPILE_BASE_URL` | Yes | Unipile API URL |
| `WEBHOOK_BASE_URL` | Yes | Your Railway URL |
| `FRONTEND_URL` | Yes | Your Vercel URL |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_API_BASE_URL` | Yes | Your Railway API URL |

---

## Troubleshooting

### "Cannot connect to Supabase"
- Verify `SUPABASE_URL` and keys in Railway
- Check Supabase dashboard for connection issues

### "Webhook not received"
- Verify `WEBHOOK_BASE_URL` points to Railway URL
- Check that `/webhooks/unipile` endpoint responds with 200

### "CORS error"
- Verify `FRONTEND_URL` in Railway matches your Vercel URL
- The API allows all origins by default

### "LinkedIn connect fails"
- Verify `UNIPILE_API_KEY` is valid
- Verify `WEBHOOK_BASE_URL` is accessible from internet

---

## Estimated Costs

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Vercel | Hobby | $0 |
| Railway | Starter | ~$5 |
| Supabase | Free/Pro | $0-25 |
| **Total** | | **$5-30/month** |

---

## CI/CD (Automatic)

Both platforms automatically deploy when you push to `main`:

- **Railway:** Rebuilds API on push
- **Vercel:** Rebuilds frontend on push

No additional CI/CD configuration needed.
