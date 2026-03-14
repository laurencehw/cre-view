import { createClient, SupabaseClient } from '@supabase/supabase-js';
import logger from './logger';

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';

/**
 * Supabase is enabled when both URL and service role key are configured.
 * When disabled, the app falls back to custom JWT auth + mock/pg data layer.
 */
export const supabaseEnabled = !!(supabaseUrl && supabaseServiceKey);

/**
 * Admin client (service role) — used server-side for auth verification
 * and storage operations. Never expose this to the client.
 */
export const supabaseAdmin: SupabaseClient | null = supabaseEnabled
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Anon client — used for operations that respect row-level security.
 */
export const supabaseAnon: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

if (supabaseEnabled) {
  logger.info('Supabase integration enabled');
}
