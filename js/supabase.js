import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://orfqztnsotyfknzspsmq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5frMoXv8usEgnGik2YpZ9g_fFlfX0a5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    // Recovery links are exchanged explicitly below so the app cannot check
    // for a session before the PKCE code has been processed.
    auth: { flowType: 'pkce', detectSessionInUrl: false },
});

export const authRecoveryReady = (async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (params.get('reset-password') !== '1' || !code) return null;

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return error.message;

    // Remove the one-time code from the address bar, but keep the reset flag
    // so the router can send the user to the password reset page.
    params.delete('code');
    const query = params.toString();
    const cleanUrl = window.location.pathname
        + (query ? `?${query}` : '')
        + window.location.hash;
    window.history.replaceState(window.history.state, '', cleanUrl);

    return null;
})();
