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
                    <label>Progress (%)
                        <input v-model.number="form.percent" type="number" min="1" max="100" step="1" required>
                    </label>
                    <label>Video Proof URL
                        <input v-model.trim="form.proofUrl" type="url" required placeholder="https://youtu.be/...">
                    </label>
                    <label>Raw Footage URL
                        <input v-model.trim="form.rawFootageUrl" type="url" required placeholder="https://drive.google.com/...">
                        <small>Required. Share the original, unedited recording with access set to Anyone with the link.</small>
                    </label>
                    <label>Extra Information (optional)
                        <textarea v-model.trim="form.notes" maxlength="1000" rows="4" placeholder="Anything the staff should know"></textarea>
                    </label>
                    <p v-if="error" class="submission-error">{{ error }}</p>
                    <p v-if="success" class="submission-success">{{ success }}</p>
                    <button class="btn" type="submit" :disabled="sending || !levels.length">{{ sending ? 'Submitting...' : 'Submit Record' }}</button>
                </form>
                <p class="submission-footnote">By submitting, you confirm that your record follows the list's submission requirements.</p>

                <section class="admin-section" style="width: calc(100% - 36px); max-width: 520px; box-sizing: border-box; margin: 22px auto 0; padding: 14px 18px; text-align: center;">
                    <p style="margin: 0; font-size: 0.9rem;">Verified a level not on the list?</p>
                    <button class="btn btn-secondary" style="margin: 8px auto 0; padding: 7px 12px; font-size: 0.85rem;" type="button" @click="showLevelRequest = !showLevelRequest">Request a Level</button>
                    <div v-if="showLevelRequest" style="margin-top: 14px; text-align: left;">
                        <h2 style="text-align: center;">Request an Unlisted Level</h2>
                        <p class="submission-intro">Send the level details to staff. If approved, it will be added to the record submission dropdown.</p>
                        <div class="submission-form">
                            <label>Level Name<input v-model.trim="levelRequest.name" required maxlength="100"></label>
                            <label>Geometry Dash Level ID<input v-model.trim="levelRequest.id" type="number" min="1" required></label>
                            <label>Verifier Username<input v-model.trim="levelRequest.verifier" required maxlength="50"></label>
                            <label>Verification Video URL<input v-model.trim="levelRequest.verification" type="url" required></label>
                            <label>AREDL Rank (optional)<input v-model.number="levelRequest.aredlRank" type="number" min="1"></label>
                            <button class="btn" type="button" @click="requestLevel" :disabled="requestSending">{{ requestSending ? 'Sending...' : 'Send Level Request' }}</button>
                        </div>
                    </div>
                </section>
            </section>
        </main>
    `,
    data: () => ({
        levels: [],
        sending: false,
        showLevelRequest: false,
        requestSending: false,
        levelRequest: { name: '', id: '', verifier: '', verification: '', aredlRank: null },
        error: '',
        success: '',
        form: { username: '', levelKey: '', percent: 100, proofUrl: '', rawFootageUrl: '', notes: '' },
    }),
    async mounted() {
        try {
            const response = await fetch('./data/_list.json');
            if (!response.ok) throw new Error('Could not load the level list.');
            const keys = await response.json();
            const staticLevels = await Promise.all(keys.map(async key => {
                const result = await fetch(`./data/${key}.json`);
                if (!result.ok) return null;
                const level = await result.json();
                return { key, name: level.name };
            }));
            this.levels = staticLevels.filter(Boolean);

            // Levels added by staff are stored in Supabase and appended to the dropdown.
            const { data, error } = await supabase.from('snagd_levels')
                .select('level_key, name').order('created_at', { ascending: true });
            if (!error) {
                const existing = new Set(this.levels.map(level => level.key));
                for (const level of data || []) {
                    if (!existing.has(level.level_key)) {
                        this.levels.push({ key: level.level_key, name: level.name });
                    }
                }
            } else if (error.code !== '42P01' && error.code !== 'PGRST205') {
                console.warn('Could not load newly added levels:', error.message);
            }
        } catch (error) {
            this.error = error.message || 'Could not load levels.';
        }
    },
    methods: {
        async requestLevel() {
            this.error = ''; this.success = '';
            const id = Number(this.levelRequest.id);
            if (!this.levelRequest.name.trim() || !this.levelRequest.verifier.trim() || !this.levelRequest.verification.trim()) {
                this.error = 'Please complete all required level request fields.'; return;
            }
            if (!Number.isSafeInteger(id) || id <= 0) { this.error = 'Enter a valid Geometry Dash level ID.'; return; }
            if (this.levelRequest.aredlRank !== null && (!Number.isInteger(this.levelRequest.aredlRank) || this.levelRequest.aredlRank < 1)) { this.error = 'AREDL rank must be a positive whole number.'; return; }
            this.requestSending = true;
            try {
                const { error } = await supabase.from('snagd_level_requests').insert({
                    level_name: this.levelRequest.name,
                    level_id: id,
                    verifier: this.levelRequest.verifier,
                    verification_url: this.levelRequest.verification,
                    aredl_rank: this.levelRequest.aredlRank || null,
                });
                if (error) throw error;
                this.success = 'Level request sent! Staff will review it.';
                this.levelRequest = { name: '', id: '', verifier: '', verification: '', aredlRank: null };
                this.showLevelRequest = false;
            } catch (error) {
                this.error = error.message || 'Could not send the level request.';
            } finally { this.requestSending = false; }
        },
        async submitRecord() {
            this.error = ''; this.success = '';
            const level = this.levels.find(item => item.key === this.form.levelKey);
            if (!level) { this.error = 'Please select a valid level.'; return; }
            if (!Number.isInteger(this.form.percent) || this.form.percent < 1 || this.form.percent > 100) {
                this.error = 'Progress must be a whole number from 1 to 100.'; return;
            }
            this.sending = true;
            try {
                const { error } = await supabase.from('snagd_submissions').insert({
                    username: this.form.username,
                    level_key: level.key,
                    level_name: level.name,
                    percent: this.form.percent,
                    hz: 1, // Hidden compatibility value; the database requires Hz to be between 1 and 10000.
                    proof_url: this.form.proofUrl,
                    raw_footage_url: this.form.rawFootageUrl,
                    notes: this.form.notes || null,
                    status: 'pending',
                });
                if (error) throw error;
                this.success = 'Submission received! List staff will review it.';
                this.form = { username: '', levelKey: '', percent: 100, proofUrl: '', rawFootageUrl: '', notes: '' };
            } catch (error) {
                this.error = error.message || 'Submission failed. Please try again.';
            } finally { this.sending = false; }
        },
    },
};