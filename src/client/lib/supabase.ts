import { createClient } from '@supabase/supabase-js';

// Injected at build time by webpack's DefinePlugin (public values only)
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_ANON_KEY as string
);

export default supabase;
