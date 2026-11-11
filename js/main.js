import routes from './routes.js';
import { supabase, authRecoveryReady } from './supabase.js';

// Finish exchanging a password-recovery code before the app checks auth state.
await authRecoveryReady;

const baseTheme = { primary: '#6855d9', background: '#f3f4f9', panel: '#ffffff', text: '#202337', header: '#191b2b' };

// Dark mode is a simple darker version of the site's standard colors.
function blendHex(color, target, amount) {
    const parse = (value) => {
        const hex = String(value || '').replace('#', '');
        if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
        return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    };
    const from = parse(color);
    const to = parse(target);
    if (!from || !to) return color;
    return '#' + from.map((channel, i) =>
        Math.round(channel + (to[i] - channel) * amount).toString(16).padStart(2, '0')
    ).join('');
}

// Discard old saved theme selections so every visitor returns to SNAGD Classic.
localStorage.removeItem('snagdTheme');

export const store = Vue.reactive({
    dark: JSON.parse(localStorage.getItem('dark')) || false,
    staff: false,
    get themeStyle() {
        const t = baseTheme;
        return {
            '--color-primary': t.primary,
            '--color-background': this.dark ? blendHex(t.background, '#080a12', 0.78) : t.background,
            '--color-on-background': this.dark ? blendHex(t.text, '#ffffff', 0.22) : t.text,
            '--snagd-panel': this.dark ? blendHex(t.panel, '#080a12', 0.76) : t.panel,
            '--snagd-header': this.dark ? blendHex(t.header, '#05060b', 0.55) : t.header,
            '--snagd-border': this.dark ? blendHex(t.primary, '#ffffff', 0.22) : '#e1e3ee',
            '--snagd-muted': this.dark ? blendHex(t.text, '#ffffff', 0.42) : '#74798e',
            '--snagd-control-bg': this.dark ? blendHex(t.panel, '#080a12', 0.72) : t.panel,
            '--snagd-control-border': this.dark ? blendHex(t.primary, '#ffffff', 0.18) : '#d9dbea',
            '--snagd-control-hover': this.dark ? blendHex(t.background, '#ffffff', 0.08) : t.background,
        };
    },
    toggleDark() {
        this.dark = !this.dark;
        localStorage.setItem('dark', JSON.stringify(this.dark));
    },
});

const app = Vue.createApp({
    data: () => ({ store }),
});
const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
});

app.use(router);
app.mount('#app');

// Check staff access on startup and whenever the Supabase session changes.
async function refreshStaffAccess(user) {
    if (!user) {
        store.staff = false;
        return;
    }
    const { data, error } = await supabase
        .from('snagd_staff')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
    store.staff = !error && !!data;
}

supabase.auth.getSession().then(({ data }) => {
    refreshStaffAccess(data.session?.user);
});

supabase.auth.onAuthStateChange((_event, session) => {
    Promise.resolve().then(() => refreshStaffAccess(session?.user));
});

router.isReady().then(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset-password') === '1') router.replace('/reset-password');
});
