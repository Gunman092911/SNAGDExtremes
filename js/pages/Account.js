import { supabase } from '../supabase.js';

export default {
    template: `
        <main class="submission-page">
            <section class="submission-panel account-panel">
                <h1>SNAGD Account</h1>
                <div v-if="!user">
                    <p class="submission-intro">Create an account or sign in to submit records and receive email updates when staff reviews them.</p>
                    <div class="account-mode">
                        <button class="btn" :class="{ 'btn-secondary': mode !== 'login' }" @click="mode = 'login'">Sign In</button>
                        <button class="btn" :class="{ 'btn-secondary': mode !== 'signup' }" @click="mode = 'signup'">Create Account</button>
                    </div>
                    <form class="submission-form" @submit.prevent="authenticate">
                        <label>Email address
                            <input v-model.trim="email" type="email" required autocomplete="email" placeholder="you@example.com">
                        </label>
                        <label>Password
                            <input v-model="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters">
                        </label>
                        <p v-if="error" class="submission-error">{{ error }}</p>
                        <p v-if="message" class="submission-success">{{ message }}</p>
                        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Please wait...' : (mode === 'signup' ? 'Create Account' : 'Sign In') }}</button>
                    </form>
                </div>
                <div v-else>
                    <div class="admin-toolbar">
                        <div>
                            <strong>Signed in</strong>
                            <p>{{ user.email }}</p>
                        </div>
                        <button class="btn btn-secondary" @click="logout" :disabled="busy">Sign Out</button>
                    </div>
                    <h2>Your Record Notifications</h2>
                    <p class="submission-intro">We'll email you whenever staff approves or rejects one of your records.</p>
                    <p v-if="loading">Loading your submissions...</p>
                    <p v-else-if="!notifications.length" class="submission-intro">You haven't submitted any records yet.</p>
                    <article v-for="item in notifications" :key="item.id" class="submission-card account-notification">
                        <div>
                            <h3>{{ item.level_name }}</h3>
                            <p>{{ item.username }} · {{ item.percent }}% · {{ item.hz }}Hz</p>
                            <small>Submitted {{ new Date(item.created_at).toLocaleString() }}</small>
                        </div>
                        <span class="account-status" :class="'status-' + item.status">{{ statusLabel(item.status) }}</span>
                    </article>
                    <p v-if="error" class="submission-error">{{ error }}</p>
                    <button class="btn btn-secondary" @click="loadNotifications" :disabled="loading">Refresh Status</button>
                </div>
            </section>
        </main>
    `,
    data: () => ({
        user: null, email: '', password: '', mode: 'login',
        busy: false, loading: false, error: '', message: '', notifications: [],
        authSubscription: null,
    }),
    async mounted() {
        const { data } = await supabase.auth.getSession();
        this.user = data.session?.user || null;
        if (this.user) await this.loadNotifications();
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            this.user = session?.user || null;
            if (this.user) Promise.resolve().then(() => this.loadNotifications());
            else this.notifications = [];
        });
        this.authSubscription = listener.subscription;
    },
    beforeUnmount() {
        this.authSubscription?.unsubscribe();
    },
    methods: {
        async authenticate() {
            this.error = ''; this.message = ''; this.busy = true;
            try {
                if (this.mode === 'signup') {
                    const { data, error } = await supabase.auth.signUp({
                        email: this.email,
                        password: this.password,
                        options: { emailRedirectTo: window.location.origin + window.location.pathname + '#/account' },
                    });
                    if (error) throw error;
                    if (data.session) {
                        this.user = data.user;
                        await this.loadNotifications();
                        this.message = 'Your account has been created.';
                    } else {
                        this.message = 'Check your email and confirm your address to finish creating your account. Then sign in here.';
                        this.mode = 'login';
                    }
                } else {
                    const { data, error } = await supabase.auth.signInWithPassword({ email: this.email, password: this.password });
                    if (error) throw error;
                    this.user = data.user;
                    await this.loadNotifications();
                }
                this.password = '';
            } catch (error) {
                this.error = error.message || 'Could not sign in.';
            } finally { this.busy = false; }
        },
        async logout() {
            this.busy = true;
            await supabase.auth.signOut();
            this.user = null; this.notifications = []; this.busy = false;
        },
        async loadNotifications() {
            if (!this.user) return;
            this.loading = true; this.error = '';
            const { data, error } = await supabase.from('snagd_submissions')
                .select('id, username, level_name, percent, hz, status, created_at')
                .eq('user_id', this.user.id)
                .order('created_at', { ascending: false });
            if (error) this.error = error.message;
            else this.notifications = data || [];
            this.loading = false;
        },
        statusLabel(status) {
            if (status === 'approved') return 'Accepted';
            if (status === 'rejected') return 'Rejected';
            return 'Under Review';
        },
    },
};