import { supabase, authRecoveryReady } from '../supabase.js';

export default {
    template: `
        <main class="submission-page">
            <section class="submission-panel admin-panel">
                <h1>Reset Password</h1>
                <p class="submission-intro">Choose a new password for your SNAGD staff account.</p>
                <form class="submission-form" @submit.prevent="updatePassword">
                    <label>New password<input v-model="password" type="password" minlength="6" required autocomplete="new-password"></label>
                    <label>Confirm new password<input v-model="confirmPassword" type="password" minlength="6" required autocomplete="new-password"></label>
                    <p v-if="error" class="submission-error">{{ error }}</p>
                    <p v-if="message" class="submission-success">{{ message }}</p>
                    <button class="btn" type="submit" :disabled="busy || checkingSession || !hasRecoverySession">{{ busy ? 'Saving...' : 'Save New Password' }}</button>
                </form>
                <p v-if="!checkingSession && !hasRecoverySession" class="submission-error">This reset link is invalid or expired. Return to the admin page and request a new one.</p>
                <router-link to="/admin">Back to admin login</router-link>
            </section>
        </main>
    `,
    data: () => ({ password: '', confirmPassword: '', checkingSession: true, hasRecoverySession: false, busy: false, error: '', message: '' }),
    async mounted() {
        const recoveryError = await authRecoveryReady;
        const { data, error } = await supabase.auth.getSession();
        this.checkingSession = false;
        this.hasRecoverySession = !!data.session;
        if (recoveryError) this.error = `Could not verify the reset link: ${recoveryError}`;
        else if (error) this.error = error.message;
    },
    methods: {
        async updatePassword() {
            this.error = '';
            this.message = '';
            if (this.password !== this.confirmPassword) {
                this.error = 'The passwords do not match.';
                return;
            }
            if (!this.hasRecoverySession) {
                this.error = 'Your reset session is missing or expired. Request a new reset email.';
                return;
            }
            this.busy = true;
            try {
                const { error } = await supabase.auth.updateUser({ password: this.password });
                if (error) throw error;
                await supabase.auth.signOut();
                this.$router.replace('/admin');
            } catch (error) {
                this.error = error.message || 'Could not update the password.';
            } finally { this.busy = false; }
        },
    },
};
