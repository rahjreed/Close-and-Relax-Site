import { createClient } from '@supabase/supabase-js'
import './deploymentConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Temporary staging diagnostic: expose only the origin used by this client.
export const supabaseEndpoint = new URL(supabaseUrl).origin

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)
