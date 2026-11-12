const baseTheme = { primary: '#6654d9', background: '#f5f6fa', panel: '#ffffff', text: '#202638', header: '#191d2d' };

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
