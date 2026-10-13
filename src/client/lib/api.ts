import axios, { isAxiosError } from 'axios';
import supabase from './supabase';

/** Axios instance for our Express API; attaches the Supabase access token. */
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
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
