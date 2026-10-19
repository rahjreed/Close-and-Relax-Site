import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createSignupNotificationHandler } from '../_shared/signupNotifications.js';

const env = (name: string) => Deno.env.get(name) || '';
const client = () => createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createSignupNotificationHandler({
  env,
  claim:(from: string,to: string)=>client().rpc('claim_realtor_signup_notifications',{delivery_from:from,delivery_to:to}),
  finish:(id: string,lease: string,outcome: string,receipt: string|null)=>client().rpc('finish_realtor_signup_notification',{
    target_id:id,claim_id:lease,outcome,message_id:receipt,
  }),
}));
