import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createSupportHandler } from '../_shared/supportContact.js';

const env = (name: string) => Deno.env.get(name) || '';
Deno.serve(createSupportHandler({
  env,
  save: (message: object, hash: string) => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  }).rpc('submit_support_message', { message, client_hash: hash }),
}));
