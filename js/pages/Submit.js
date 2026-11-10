import { supabase } from '../supabase.js';

export default {
    template: `
        <main class="submission-page">
            <section class="submission-panel">
                <h1>Submit a Record</h1>
                <p class="submission-intro">Submit your Geometry Dash record for the list staff to review. Your record will not appear until it is approved.</p>
                <form @submit.prevent="submitRecord" class="submission-form">
                    <label>Geometry Dash Username
                        <input v-model.trim="form.username" required maxlength="32" placeholder="Your in-game username">
                    </label>
                    <label>Level
                        <select v-model="form.levelKey" required>
                            <option value="" disabled>Select a level</option>
                            <option v-for="level in levels" :key="level.key" :value="level.key">{{ level.name }}</option>
                        </select>
                    </label>
                    <div class="submission-row">
                        <label>Progress (%)
                            <input v-model.number="form.percent" type="number" min="1" max="100" step="1" required>
                        </label>
                        <label>Refresh Rate (Hz)
                            <input v-model.number="form.hz" type="number" min="1" max="10000" required>
                        </label>
                    </div>
                    <label>Video Proof URL
                        <input v-model.trim="form.proofUrl" type="url" required placeholder="https://youtu.be/...">
                    </label>
                    <label>Extra Information (optional)
                        <textarea v-model.trim="form.notes" maxlength="1000" rows="4" placeholder="Anything the staff should know"></textarea>
                    </label>
                    <p v-if="error" class="submission-error">{{ error }}</p>
                    <p v-if="success" class="submission-success">{{ success }}</p>
                    <button class="btn" type="submit" :disabled="sending || !levels.length">{{ sending ? 'Submitting...' : 'Submit Record' }}</button>
                </form>
                <p class="submission-footnote">By submitting, you confirm that your record follows the list's submission requirements.</p>
            </section>
        </main>
    `,
    data: () => ({
        levels: [],
        sending: false,
        error: '',
        success: '',
        form: { username: '', levelKey: '', percent: 100, hz: 240, proofUrl: '', notes: '' },
    }),
    async mounted() {
        try {
            const response = await fetch('/data/_list.json');
            if (!response.ok) throw new Error('Could not load the level list.');
            const keys = await response.json();
            this.levels = (await Promise.all(keys.map(async key => {
                const result = await fetch(`/data/${key}.json`);
                if (!result.ok) return null;
                const level = await result.json();
                return { key, name: level.name };
            }))).filter(Boolean);
        } catch (error) {
            this.error = error.message || 'Could not load levels.';
        }
    },
    methods: {
        async submitRecord() {
            this.error = '';
            this.success = '';
            const level = this.levels.find(item => item.key === this.form.levelKey);
            if (!level) { this.error = 'Please select a valid level.'; return; }
            if (!Number.isInteger(this.form.percent) || this.form.percent < 1 || this.form.percent > 100) {
                this.error = 'Progress must be a whole number from 1 to 100.'; return;
            }
            if (!Number.isInteger(this.form.hz) || this.form.hz < 1) {
                this.error = 'Refresh rate must be a positive whole number.'; return;
            }
            this.sending = true;
            try {
                const { error } = await supabase.from('snagd_submissions').insert({
                    username: this.form.username,
                    level_key: level.key,
                    level_name: level.name,
                    percent: this.form.percent,
                    hz: this.form.hz,
                    proof_url: this.form.proofUrl,
                    notes: this.form.notes || null,
                    status: 'pending',
                });
                if (error) throw error;
                this.success = 'Submission received! List staff will review it.';
                this.form = { username: '', levelKey: '', percent: 100, hz: 240, proofUrl: '', notes: '' };
            } catch (error) {
                this.error = error.message || 'Submission failed. Please try again.';
            } finally {
                this.sending = false;
            }
        },
    },
};
