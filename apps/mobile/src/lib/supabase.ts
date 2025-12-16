import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { sessionStorage } from './secure-session';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
function publicKey(value: string) {
  if (value.startsWith('sb_secret_')) return false;
  try {
    if (value.split('.').length === 3)
      return (
        JSON.parse(
          atob(value.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
        ).role === 'anon'
      );
  } catch {
    return false;
  }
  return value.startsWith('sb_publishable_');
}
export const supabase =
  url && /^https?:\/\//.test(url) && key && publicKey(key)
    ? createClient(url, key, {
        auth: {
          storage: sessionStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
export async function requireUser(userId: string) {
  if (!supabase) throw new Error('Sign-in unavailable');
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== userId)
    throw new Error('Sign in to your account again');
  return supabase;
}
