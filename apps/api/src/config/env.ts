import { z } from 'zod';
import { config } from 'dotenv';

// Load .env file
config({ path: '../../.env' });

const envSchema = z.object({
  PORT: z.string().default('3001'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UNIPILE_API_KEY: z.string().min(1),
  UNIPILE_BASE_URL: z.string().url().default('https://api28.unipile.com:15873'),
  WEBHOOK_BASE_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
