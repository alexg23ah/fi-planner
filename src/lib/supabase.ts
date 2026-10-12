import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * If Supabase redirects back with an OAuth error it lands in the URL (hash or query).
 * Capture it before the client tidies the URL so the sign-in screen can show it.
 */
function readAuthError(): string | null {
  if (typeof window === 'undefined') return null;
  const params = [new URLSearchParams(window.location.search), new URLSearchParams(window.location.hash.replace(/^#/, ''))];
  for (const p of params) {
    const err = p.get('error_description') || p.get('error');
    if (err) return `${err}${p.get('error_code') ? ` (${p.get('error_code')})` : ''}`;
  }
  return null;
}
export const initialAuthError = readAuthError();

/** Null when env vars are missing — the app then runs in local-only mode. */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } })
  : null;
