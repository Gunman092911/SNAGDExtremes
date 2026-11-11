import routes from './routes.js';
import { supabase } from './supabase.js';

const themes = {
    default: { name: 'SNAGD Classic', primary: '#6855d9', background: '#f3f4f9', panel: '#ffffff', text: '#202337', header: '#191b2b' },
    cataclysm: { name: 'Copper', primary: '#e04432', background: '#171313', panel: '#241b1b', text: '#f7e9e5', header: '#100b0b' },
    bloodbath: { name: 'Ruby', primary: '#c52d25', background: '#211313', panel: '#301b1b', text: '#fff0e8', header: '#130909' },
    sonicwave: { name: 'Sapphire', primary: '#168ee8', background: '#101b2b', panel: '#17283d', text: '#eaf5ff', header: '#091321' },
    slaughterhouse: { name: 'Garnet', primary: '#b51e32', background: '#160d13', panel: '#25141d', text: '#ffeef2', header: '#0d070b' },
    limbo: { name: 'Amber', primary: '#d5a62e', background: '#191812', panel: '#282517', text: '#fff8dc', header: '#100f0a' },
    tidalwave: { name: 'Aqua', primary: '#10a9bd', background: '#eaf8fa', panel: '#ffffff', text: '#17343a', header: '#102b32' },
    xo: { name: 'Silver', primary: '#b8b8c5', background: '#15151b', panel: '#22222b', text: '#f2f2f7', header: '#09090e' },
};

const savedTheme = (() => {
    try { return JSON.parse(localStorage.getItem('snagdTheme')) || themes.default; }
    catch { return themes.default; }
})();

// Rename the built-in presets without changing anyone's saved colors.
const oldPresetNames = { 'Cataclysm': 'Copper', 'Bloodbath': 'Ruby', 'Sonic Wave': 'Sapphire', 'Slaughterhouse': 'Garnet', 'Limbo': 'Amber', 'Tidal Wave': 'Aqua', 'XO': 'Silver' };
if (oldPresetNames[savedTheme.name]) {
    savedTheme.name = oldPresetNames[savedTheme.name];
    localStorage.setItem('snagdTheme', JSON.stringify(savedTheme));
}

export const store = Vue.reactive({
    dark: JSON.parse(localStorage.getItem('dark')) || false,
    staff: false,
    themeOpen: false,
    themeName: savedTheme.name || 'My Theme',
    theme: { ...themes.default, ...savedTheme },
    themeDraft: { ...themes.default },
    themes,
    get themeStyle() {
        const t = this.theme;
        return {
            '--color-primary': t.primary,
            '--color-background': t.background,
            '--color-on-background': t.text,
            '--snagd-panel': t.panel,
            '--snagd-header': t.header,
            '--snagd-border': this.dark ? '#3a4054' : '#e1e3ee',
            '--snagd-muted': this.dark ? '#a0a6bc' : '#74798e',
            '--snagd-control-bg': t.panel,
            '--snagd-control-border': this.dark ? '#3a4054' : '#d9dbea',
            '--snagd-control-hover': t.background,
        };
    },
    toggleDark() {
        this.dark = !this.dark;
        localStorage.setItem('dark', JSON.stringify(this.dark));
    },
    openThemes() {
        this.themeDraft = { ...this.theme };
        this.themeName = this.theme.name || 'My Theme';
        this.themeOpen = !this.themeOpen;
    },
    useTheme(key) {
        this.theme = { ...this.themes[key] };
        this.themeName = this.theme.name;
        this.saveTheme();
    },
    saveCustomTheme() {
        this.theme = { ...this.themeDraft, name: this.themeName.trim() || 'My Theme' };
        this.saveTheme();
        this.themeOpen = false;
    },
    saveTheme() {
        localStorage.setItem('snagdTheme', JSON.stringify(this.theme));
    },
    resetTheme() {
        this.useTheme('default');
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
