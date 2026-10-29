import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isConfigured = Boolean(url && key);
// Without configuration the app still renders a clear message (see Login); the client points at a harmless placeholder.
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'not-configured', { auth: { persistSession: true, autoRefreshToken: true } });
