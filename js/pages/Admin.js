import { supabase } from '../supabase.js';
import { store } from '../main.js';
import { fetchList } from '../content.js';

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

                    <section class="admin-section">
                        <h2>Reorder Public List ({{ orderedLevels.length }} levels)</h2>
                        <p class="submission-intro">Move levels to change their public ranking. Changes also update leaderboard points.</p>
                        <p v-if="!orderedLevels.length">Loading levels...</p>
                        <article v-for="(level, index) in orderedLevels" :key="level.path" class="submission-card">
                            <div><strong>#{{ index + 1 }} — {{ level.name }}</strong></div>
                            <div class="submission-actions">
                                <button class="btn btn-secondary" @click="moveLevel(index, index - 1)" :disabled="busy || index === 0">Up</button>
                                <button class="btn btn-secondary" @click="moveLevel(index, index + 1)" :disabled="busy || index === orderedLevels.length - 1">Down</button>
                                <input v-model.number="level.moveTo" type="number" min="1" :max="orderedLevels.length" aria-label="New rank" style="width: 5rem;">
                                <button class="btn" @click="moveLevel(index, level.moveTo - 1)" :disabled="busy || !level.moveTo || level.moveTo < 1 || level.moveTo > orderedLevels.length">Move</button>
                            </div>
                        </article>
                        <button class="btn" @click="saveOrder" :disabled="busy || !orderedLevels.length">Save List Order</button>
                    </section>
                    <section class="admin-section">
                        <h2>Manage Records</h2>
                        <p class="submission-intro">Remove an individual record from a level without deleting the level.</p>
                        <label>Choose a level
                            <select v-model="selectedRecordLevel">
                                <option value="">Select a level...</option>
                                <option v-for="level in orderedLevels" :key="level.path" :value="level.path">{{ level.name }}</option>
                            </select>
                        </label>
                        <p v-if="selectedRecordLevel && !recordsForSelectedLevel.length">This level has no records.</p>
                        <article v-for="record in recordsForSelectedLevel" :key="record.user + record.link + record.percent" class="submission-card">
                            <div>
                                <strong>{{ record.user }} — {{ record.percent }}%</strong>
                                <p>{{ record.hz }}Hz · <a :href="record.link" target="_blank" rel="noopener">Proof video</a></p>
                            </div>
                            <div class="submission-actions">
                                <button class="btn btn-danger" @click="deleteRecord(record)" :disabled="busy">Remove Record</button>
                            </div>
                        </article>
                    </section>

                    <section class="admin-section">
                        <h2>Manage Submitted Levels ({{ levels.length }})</h2>
                        <p class="submission-intro">Remove a level you added by mistake. This removes it from the public list and submission dropdown.</p>
                        <p v-if="!levels.length">No staff-added levels yet.</p>
                        <article v-for="level in levels" :key="level.level_key" class="submission-card">
                            <div>
                                <h3>{{ level.name }}</h3>
                                <small>Level ID: {{ level.id }} · Verified by {{ level.verifier }}</small>
                            </div>
                            <div class="submission-actions">
                                <button class="btn btn-danger" @click="deleteLevel(level)" :disabled="busy">Delete</button>
                            </div>
                        </article>
                    </section>

                    <section class="admin-section">
                        <h2>Unlisted Level Requests ({{ levelRequests.length }})</h2>
                        <p v-if="!levelRequests.length">There are no pending level requests.</p>
                        <article v-for="request in levelRequests" :key="request.id" class="submission-card level-request-card">
                            <div class="level-request-details">
                                <h3>{{ request.level_name }}</h3>
                                <div class="level-request-meta">
                                    <span><strong>Level ID</strong> {{ request.level_id }}</span>
                                    <span><strong>Verifier</strong> {{ request.verifier }}</span>
                                    <span v-if="request.aredl_rank"><strong>AREDL</strong> #{{ request.aredl_rank }}</span>
                                </div>
                                <a class="level-request-video" :href="request.verification_url" target="_blank" rel="noopener">Watch verification video ↗</a>
                                <small class="level-request-date">Requested {{ new Date(request.created_at).toLocaleString() }}</small>
                            </div>
                            <div class="submission-actions level-request-actions">
                                <button class="btn" @click="reviewLevelRequest(request, 'approved')" :disabled="busy">Approve & Add</button>
                                <button class="btn btn-danger" @click="reviewLevelRequest(request, 'rejected')" :disabled="busy">Reject</button>
                            </div>
                        </article>
                    </section>

                    <h2>Pending Submissions ({{ submissions.length }})</h2>
                    <p v-if="loading">Loading submissions...</p>
                    <p v-else-if="!submissions.length">There are no pending submissions.</p>
                    <article v-for="item in submissions" :key="item.id" class="submission-card">
                        <div>
                            <h3>{{ item.username }} — {{ item.level_name }}</h3>
                            <p>{{ item.percent }}% · {{ item.hz }}Hz</p>
                            <p><a :href="item.proof_url" target="_blank" rel="noopener">Open video proof</a></p>
                            <p v-if="item.raw_footage_url"><a :href="item.raw_footage_url" target="_blank" rel="noopener">Open raw footage</a></p>
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
    data: () => ({
        email: '', password: '', user: null, submissions: [], levelRequests: [], levels: [], orderedLevels: [],
        originalOrder: [], movedLevelPaths: [],
        selectedRecordLevel: '',
        loading: false, busy: false, error: '', message: '',
        newLevel: { name: '', id: '', verifier: '', verification: '', percentToQualify: 100 },
    }),
    async mounted() {
        const { data } = await supabase.auth.getSession();
        if (data.session) await this.setUser(data.session.user);
        supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                this.user = null;
                store.staff = false;
                this.submissions = [];
                return;
            }

            // Keep the dashboard hidden until the account's staff permission is checked.
            this.user = null;
            store.staff = false;
            Promise.resolve().then(() => this.setUser(session.user));
        });
    },
    computed: {
        recordsForSelectedLevel() {
            const level = this.orderedLevels.find(item => item.path === this.selectedRecordLevel);
            return level ? level.records : [];
        },
    },
    methods: {
        async setUser(user) {
            const { data, error } = await supabase.from('snagd_staff').select('user_id').eq('user_id', user.id).maybeSingle();
            if (error || !data) {
                store.staff = false;
                await supabase.auth.signOut();
                this.error = 'This account is not authorized to access the staff dashboard.';
                return;
            }
            this.user = user;
            store.staff = true;
            await Promise.all([this.loadSubmissions(), this.loadLevels(), this.loadLevelRequests()]);
        },
        async login() {
            this.error = ''; this.message = ''; this.busy = true;
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email: this.email, password: this.password });
                if (error) throw error;
                await this.setUser(data.user);
            } catch (error) {
                this.error = error.message || 'Sign in failed.';
            } finally { this.busy = false; }
        },
        async sendPasswordReset() {
            this.error = ''; this.message = '';
            if (!this.email) { this.error = 'Enter your admin email address first.'; return; }
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
            this.user = null; store.staff = false; this.submissions = [];
        },
        async loadLevels() {
            await this.loadOrder();
            const { data, error } = await supabase.from('snagd_levels')
                .select('level_key, id, name, verifier')
                .order('created_at', { ascending: true });
            if (error) this.error = error.message;
            else this.levels = data || [];
        },
        async loadOrder() {
            const list = await fetchList();
            this.orderedLevels = (list || []).filter(([level]) => !!level).map(([level]) => ({ ...level, moveTo: null }));
            this.originalOrder = this.orderedLevels.map(level => level.path);
            this.movedLevelPaths = [];
            if (!this.selectedRecordLevel && this.orderedLevels.length) this.selectedRecordLevel = this.orderedLevels[0].path;
        },
        moveLevel(fromIndex, toIndex) {
            if (toIndex < 0 || toIndex >= this.orderedLevels.length || fromIndex === toIndex) return;
            const moved = this.orderedLevels.splice(fromIndex, 1)[0];
            this.orderedLevels.splice(toIndex, 0, moved);
            if (!this.movedLevelPaths.includes(moved.path)) this.movedLevelPaths.push(moved.path);
            this.orderedLevels.forEach(level => { level.moveTo = null; });
        },
        async saveOrder() {
            this.error = ''; this.message = ''; this.busy = true;
            try {
                const previousPositions = new Map(this.originalOrder.map((path, index) => [path, index]));
                const rows = this.orderedLevels.map((level, position) => ({ level_key: level.path, position }));
                const { error } = await supabase.from('snagd_list_order').upsert(rows, { onConflict: 'level_key' });
                if (error) throw error;

                const movedLevels = this.movedLevelPaths
                    .map(path => {
                        const index = this.orderedLevels.findIndex(level => level.path === path);
                        if (index < 0 || previousPositions.get(path) === index) return null;
                        const level = this.orderedLevels[index];
                        return {
                            eventType: 'level_moved',
                            levelName: level.name,
                            rank: index + 1,
                            aboveName: index > 0 ? this.orderedLevels[index - 1].name : '',
                            belowName: index < this.orderedLevels.length - 1 ? this.orderedLevels[index + 1].name : '',
                        };
                    })
                    .filter(Boolean);

                let announcementMessage = '';
                if (movedLevels.length) {
                    const results = await Promise.all(movedLevels.map(activity => this.announceActivity(activity)));
                    const sent = results.filter(Boolean).length;
                    announcementMessage = sent === results.length
                        ? ' Discord announcements sent to both servers!'
                        : ' Some Discord announcements failed; check the webhook setup.';
                }

                this.originalOrder = this.orderedLevels.map(level => level.path);
                this.movedLevelPaths = [];
                this.message = 'The public list order has been saved.' + announcementMessage;
                this.orderedLevels.forEach(level => { level.moveTo = null; });
            } catch (error) {
                this.error = error.message || 'Could not save the list order. Check that the list-order SQL setup has been run.';
            } finally { this.busy = false; }
        },
        async loadLevelRequests() {
            const { data, error } = await supabase.from('snagd_level_requests')
                .select('*').eq('status', 'pending').order('created_at', { ascending: true });
            if (error) this.error = error.message;
            else this.levelRequests = data || [];
        },
        async reviewLevelRequest(request, status) {
            this.error = ''; this.message = ''; this.busy = true;
            try {
                if (status === 'approved') {
                    const levelKey = request.level_name.toLowerCase()
                        .normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '')
                        .replace(/[^a-z0-9]+/g, '').slice(0, 60);
                    if (!levelKey) throw new Error('The level name must contain letters or numbers.');
                    const { error: addError } = await supabase.from('snagd_levels').insert({
                        level_key: levelKey,
                        id: request.level_id,
                        name: request.level_name,
                        verifier: request.verifier,
                        verification: request.verification_url,
                        percent_to_qualify: 100,
                    });
                    if (addError) {
                        if (addError.code === '23505') throw new Error('A level with that name or Geometry Dash ID already exists.');
                        throw addError;
                    }
                }
                const { error } = await supabase.from('snagd_level_requests')
                    .update({ status, reviewed_at: new Date().toISOString() }).eq('id', request.id);
                if (error) throw error;
                const announcementSent = await this.announceActivity({
                    eventType: status === 'approved' ? 'level_added' : 'level_request_rejected',
                    levelName: request.level_name,
                    levelId: request.level_id,
                    verifier: request.verifier,
                });
                this.message = (status === 'approved'
                    ? request.level_name + ' was approved and added. Use Reorder Public List to choose its position.'
                    : request.level_name + ' request was rejected.') +
                    (announcementSent ? ' Discord announcement sent!' : ' Discord announcement failed. Check the webhook setup.');
                await Promise.all([this.loadLevelRequests(), this.loadLevels()]);
            } catch (error) {
                this.error = error.message || 'Could not review this level request.';
            } finally { this.busy = false; }
        },
        async announceActivity(activity) {
            try {
                const { error } = await supabase.functions.invoke('announce-new-level', { body: activity });
                if (error) {
                    console.error('Discord announcement failed:', error);
                    return false;
                }
                return true;
            } catch (error) {
                console.error('Discord announcement failed:', error);
                return false;
            }
        },
        async loadSubmissions() {
            this.loading = true;
            const { data, error } = await supabase.from('snagd_submissions').select('*').eq('status', 'pending').order('created_at', { ascending: true });
            if (error) this.error = error.message;
            else this.submissions = data || [];
            this.loading = false;
        },
        async addLevel() {
            this.error = ''; this.message = '';
            const id = Number(this.newLevel.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                this.error = 'Enter a valid positive Geometry Dash level ID.';
                return;
            }
            const levelKey = this.newLevel.name.toLowerCase()
                .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '').slice(0, 60);
            if (!levelKey) { this.error = 'The level name must contain letters or numbers.'; return; }
            this.busy = true;
            try {
                const { error } = await supabase.from('snagd_levels').insert({
                    level_key: levelKey,
                    id,
                    name: this.newLevel.name,
                    verifier: this.newLevel.verifier,
                    verification: this.newLevel.verification,
                    percent_to_qualify: this.newLevel.percentToQualify,
                });
                if (error) {
                    if (error.code === '23505') throw new Error('A level with that generated ID or name already exists.');
                    throw error;
                }
                this.message = this.newLevel.name + ' was added. It is now available for record submissions and appears at the bottom of the list.';
                this.newLevel = { name: '', id: '', verifier: '', verification: '', percentToQualify: 100 };
                await this.loadLevels();
            } catch (error) {
                this.error = error.message || 'Could not add the level.';
            } finally { this.busy = false; }
        },
        async deleteLevel(level) {
            if (!window.confirm('Delete "' + level.name + '"? It will be removed from the public list and submission dropdown.')) return;
            this.error = ''; this.message = ''; this.busy = true;
            try {
                const { error } = await supabase.from('snagd_levels').delete().eq('level_key', level.level_key);
                if (error) throw error;
                this.levels = this.levels.filter(item => item.level_key !== level.level_key);
                const announcementSent = await this.announceActivity({
                    eventType: 'level_removed',
                    levelName: level.name,
                    levelId: level.id,
                    verifier: level.verifier,
                });
                this.message = level.name + ' was deleted.' +
                    (announcementSent ? ' Discord announcement sent!' : ' Discord announcement failed.');
            } catch (error) {
                this.error = error.message || 'Could not delete this level.';
            } finally { this.busy = false; }
        },
        async deleteRecord(record) {
            const level = this.orderedLevels.find(item => item.path === this.selectedRecordLevel);
            if (!level) return;
            if (!window.confirm('Remove ' + record.user + '\'s ' + record.percent + '% record from ' + level.name + '?')) return;
            this.error = ''; this.message = ''; this.busy = true;
            try {
                const { error } = await supabase.from('snagd_removed_records').upsert({
                    level_key: level.path,
                    username: record.user,
                    proof_url: record.link,
                    percent: Number(record.percent),
                    hz: Number(record.hz),
                }, { onConflict: 'level_key,username,proof_url,percent,hz', ignoreDuplicates: true });
                if (error) throw error;
                const announcementSent = await this.announceActivity({
                    eventType: 'record_removed',
                    username: record.user,
                    levelName: level.name,
                    percent: record.percent,
                    hz: record.hz,
                    proofUrl: record.link,
                });
                this.message = record.user + '\'s record was removed from ' + level.name + '.' +
                    (announcementSent ? ' Discord announcement sent!' : ' Discord announcement failed.');
                await this.loadOrder();
            } catch (error) {
                this.error = error.message || 'Could not remove this record. Check that the record-removal SQL setup has been run.';
            } finally { this.busy = false; }
        },
        async review(item, status) {
            this.error = ''; this.message = ''; this.busy = true;
            try {
                const { error } = await supabase.from('snagd_submissions').update({ status, reviewed_at: new Date().toISOString() }).eq('id', item.id);
                if (error) throw error;
                const announcementSent = await this.announceActivity({
                    eventType: status === 'approved' ? 'record_added' : 'record_rejected',
                    username: item.username,
                    levelName: item.level_name,
                    percent: item.percent,
                    hz: item.hz,
                    proofUrl: item.proof_url,
                });
                this.message = (status === 'approved'
                    ? 'Record approved. It will appear on the public list.'
                    : 'Submission rejected.') +
                    (announcementSent ? ' Discord announcement sent!' : ' Discord announcement failed.');
                await this.loadSubmissions();
            } catch (error) {
                this.error = error.message || 'Could not update this submission.';
            } finally { this.busy = false; }
        },
    },
};
