import { supabase } from '../supabase.js';

export default {
    template: `
        <main class="submission-page">
            <section class="submission-panel admin-panel">
                <h1>Staff Dashboard</h1>
                <div v-if="!user" class="submission-form">
                    <p class="submission-intro">Sign in with an authorized staff account to review submissions.</p>
                    <form @submit.prevent="login">
                        <label>Email<input v-model.trim="email" type="email" required autocomplete="username"></label>
                        <label>Password<input v-model="password" type="password" required autocomplete="current-password"></label>
                        <p v-if="error" class="submission-error">{{ error }}</p>
                        <p v-if="message" class="submission-success">{{ message }}</p>
                        <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Signing in...' : 'Sign In' }}</button>
                        <button class="btn btn-secondary" type="button" @click="sendPasswordReset" :disabled="busy">Send Password Reset Email</button>
                    </form>
                    <p class="submission-intro">Enter your email above, then use the button to receive a password reset link.</p>
                    <router-link to="/submit">Back to submissions</router-link>
                </div>
                <div v-else>
                    <div class="admin-toolbar">
                        <p>Signed in as {{ user.email }}</p>
                        <button class="btn btn-secondary" @click="logout">Sign Out</button>
                    </div>
                    <p v-if="error" class="submission-error">{{ error }}</p>
                    <p v-if="message" class="submission-success">{{ message }}</p>
                    <h2>Pending Submissions ({{ submissions.length }})</h2>
                    <p v-if="loading">Loading submissions...</p>
                    <p v-else-if="!submissions.length">There are no pending submissions.</p>
                    <article v-for="item in submissions" :key="item.id" class="submission-card">
                        <div>
                            <h3>{{ item.username }} — {{ item.level_name }}</h3>
                            <p>{{ item.percent }}% · {{ item.hz }}Hz</p>
                            <p><a :href="item.proof_url" target="_blank" rel="noopener">Open video proof</a></p>
                            <p v-if="item.notes">{{ item.notes }}</p>
                            <small>Submitted {{ new Date(item.created_at).toLocaleString() }}</small>
                        </div>
                        <div class="submission-actions">
                            <button class="btn" @click="review(item, 'approved')" :disabled="busy">Approve</button>
                            <button class="btn btn-danger" @click="review(item, 'rejected')" :disabled="busy">Reject</button>
                        </div>
                    </article>
                </div>
            </section>
        </main>
    `,
    data: () => ({ email: '', password: '', user: null, submissions: [], loading: false, busy: false, error: '', message: '' }),
    async mounted() {
        const { data } = await supabase.auth.getSession();
        if (data.session) await this.setUser(data.session.user);
        supabase.auth.onAuthStateChange((_event, session) => {
            this.user = session?.user || null;
            if (!session) this.submissions = [];
        });
    },
    methods: {
        async setUser(user) {
            const { data, error } = await supabase.from('snagd_staff').select('user_id').eq('user_id', user.id).maybeSingle();
            if (error || !data) {
                await supabase.auth.signOut();
                this.error = 'This account is not authorized to access the staff dashboard.';
                return;
            }
            this.user = user;
            await this.loadSubmissions();
        },
        async login() {
            this.error = '';
            this.message = '';
            this.busy = true;
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email: this.email, password: this.password });
                if (error) throw error;
                await this.setUser(data.user);
            } catch (error) {
                this.error = error.message || 'Sign in failed.';
            } finally { this.busy = false; }
        },
        async sendPasswordReset() {
            this.error = '';
            this.message = '';
            if (!this.email) {
                this.error = 'Enter your admin email address first.';
                return;
            }
            this.busy = true;
            try {
                const redirectTo = window.location.origin + window.location.pathname + '?reset-password=1';
                const { error } = await supabase.auth.resetPasswordForEmail(this.email, { redirectTo });
                if (error) throw error;
                this.message = 'Password reset email sent. Open the newest email and follow its link.';
            } catch (error) {
                this.error = error.message || 'Could not send the password reset email.';
            } finally { this.busy = false; }
        },
        async logout() {
            await supabase.auth.signOut();
            this.user = null;
            this.submissions = [];
        },
        async loadSubmissions() {
            this.loading = true;
            const { data, error } = await supabase.from('snagd_submissions').select('*').eq('status', 'pending').order('created_at', { ascending: true });
            if (error) this.error = error.message;
            else this.submissions = data || [];
            this.loading = false;
        },
        async review(item, status) {
            this.error = '';
            this.message = '';
            this.busy = true;
            try {
                const { error } = await supabase.from('snagd_submissions').update({ status, reviewed_at: new Date().toISOString() }).eq('id', item.id);
                if (error) throw error;
                this.message = status === 'approved' ? 'Record approved. It will appear on the public list.' : 'Submission rejected.';
                await this.loadSubmissions();
            } catch (error) {
                this.error = error.message || 'Could not update this submission.';
            } finally { this.busy = false; }
        },
    },
};
