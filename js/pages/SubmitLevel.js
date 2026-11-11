import { supabase } from '../supabase.js';

export default {
    template: `
        <main class="submission-page">
            <section class="submission-panel">
                <h1>Submit a New Level</h1>
                <p class="submission-intro">Submit a newly verified Extreme Demon that is not currently on SNAGD. Staff will review it and choose its position on the list.</p>
                <form class="submission-form" @submit.prevent="submitLevel">
                    <label>Level Name
                        <input v-model.trim="form.name" required maxlength="100" placeholder="Level name">
                    </label>
                    <label>Geometry Dash Level ID
                        <input v-model.trim="form.levelId" inputmode="numeric" pattern="[0-9]+" required placeholder="Level ID">
                    </label>
                    <label>Verifier Username
                        <input v-model.trim="form.verifier" required maxlength="32" placeholder="Verifier's GD username">
                    </label>
                    <label>Verification Video URL
                        <input v-model.trim="form.verificationUrl" type="url" required placeholder="https://youtu.be/...">
                    </label>
                    <label>AREDl Placement (optional)
                        <input v-model.number="form.aredlRank" type="number" min="1" step="1" placeholder="Current AREDL rank">
                        <small>This helps staff judge where the level belongs. It does not automatically determine the SNAGD rank.</small>
                    </label>
                    <p v-if="error" class="submission-error">{{ error }}</p>
                    <p v-if="success" class="submission-success">{{ success }}</p>
                    <button class="btn" type="submit" :disabled="sending">{{ sending ? 'Submitting...' : 'Submit Level' }}</button>
                </form>
            </section>
        </main>
    `,
    data: () => ({
        form: { name: '', levelId: '', verifier: '', verificationUrl: '', aredlRank: null },
        sending: false, error: '', success: '',
    }),
    methods: {
        async submitLevel() {
            this.error = ''; this.success = '';
            const id = Number(this.form.levelId);
            if (!Number.isSafeInteger(id) || id <= 0) { this.error = 'Enter a valid positive Geometry Dash level ID.'; return; }
            if (this.form.aredlRank !== null && this.form.aredlRank !== '' && (!Number.isInteger(this.form.aredlRank) || this.form.aredlRank < 1)) {
                this.error = 'AREDl placement must be a positive whole number.'; return;
            }
            this.sending = true;
            try {
                const { error } = await supabase.from('snagd_level_submissions').insert({
                    level_name: this.form.name,
                    level_id: id,
                    verifier: this.form.verifier,
                    verification_url: this.form.verificationUrl,
                    aredl_rank: this.form.aredlRank || null,
                    status: 'pending',
                });
                if (error) throw error;
                this.success = 'Level submitted! Staff will review it and choose its list position.';
                this.form = { name: '', levelId: '', verifier: '', verificationUrl: '', aredlRank: null };
            } catch (error) { this.error = error.message || 'Could not submit this level.'; }
            finally { this.sending = false; }
        },
    },
};
