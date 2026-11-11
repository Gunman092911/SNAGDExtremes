import routes from './routes.js';
import { supabase, authRecoveryReady } from './supabase.js';

// Finish exchanging a password-recovery code before the app checks auth state.
await authRecoveryReady;

const baseTheme = { primary: '#6654d9', background: '#f5f6fa', panel: '#ffffff', text: '#202638', header: '#191d2d' };

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
            '--color-background': this.dark ? '#07090f' : t.background,
            '--color-on-background': this.dark ? '#edf0f8' : t.text,
            '--snagd-panel': this.dark ? '#10131c' : t.panel,
            '--snagd-header': this.dark ? '#080a11' : t.header,
            '--snagd-border': this.dark ? '#252b3a' : '#e5e7ef',
            '--snagd-muted': this.dark ? '#a6aec2' : '#737b8e',
            '--snagd-control-bg': this.dark ? '#0d1018' : '#ffffff',
            '--snagd-control-border': this.dark ? '#282e3d' : '#dfe2eb',
            '--snagd-control-hover': this.dark ? '#181d29' : '#f7f7fc',
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
