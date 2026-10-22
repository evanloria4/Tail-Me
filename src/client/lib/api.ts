import axios, { isAxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import supabase from './supabase';

/** Axios instance for our Express API; attaches the Supabase access token. */
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

/**
 * A 401 on a signed-in request means the session went stale. Refresh it once
 * and retry; if that fails, sign out and go straight to the login page
 * instead of showing the error.
 */
let redirecting = false;
api.interceptors.response.use(undefined, async (err) => {
  const config = err?.config as
    | (InternalAxiosRequestConfig & { retried?: boolean })
    | undefined;
  const sentToken = !!config?.headers?.get?.('Authorization');
  if (!isAxiosError(err) || err.response?.status !== 401 || !sentToken) {
    throw err;
  }
  if (config && !config.retried) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) {
      config.retried = true;
      return api(config);
    }
  }
  if (!redirecting) {
    redirecting = true;
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    window.location.replace('/login');
  }
  // Keep callers waiting (no error flash) while the page leaves
  return new Promise(() => {});
});

/** Pulls the `{ error }` message our API returns, with a fallback. */
export function apiErrorMessage(
  err: unknown,
  fallback = 'Something went wrong'
) {
  if (isAxiosError(err)) return err.response?.data?.error ?? fallback;
  return fallback;
}

export default api;
