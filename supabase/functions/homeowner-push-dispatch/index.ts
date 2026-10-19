import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createDispatchHandler } from '../_shared/homeownerPushHandlers.js';
import { sendPush } from '../_shared/pushTransport.ts';
const env = (name: string) => Deno.env.get(name) || '';
Deno.serve(createDispatchHandler({ env, send: sendPush,
  client: () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } }),
}));
