import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://orfqztnsotyfknzspsmq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5frMoXv8usEgnGik2YpZ9g_fFlfX0a5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true },
});
