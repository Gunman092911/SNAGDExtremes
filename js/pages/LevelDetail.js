import { store } from "../main.js";
import { embed } from "../util.js";
import { score } from "../score.js";
import { fetchList } from "../content.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

export default {
    components: { LevelAuthors },
    template: `
        <main class="page-level-detail" v-if="loading">
            <div class="detail-loading">Loading level...</div>
        </main>
        <main class="page-level-detail" v-else-if="level">
            <section class="detail-main">
                <router-link class="back-link" to="/">← Back to list</router-link>
                <div class="detail-heading">
                    <div>
                        <p class="detail-kicker">SNAGD LEVEL PROFILE</p>
                        <h1>{{ level.name }}</h1>
                        <p class="detail-rank">{{ rank <= 150 ? '#' + rank : 'Legacy level' }}</p>
                    </div>
                    <div class="detail-points">
                        <span>Completion points</span>
                        <strong>{{ score(rank, 100, level.percentToQualify) }}</strong>
                    </div>
                </div>
                <div class="detail-video-wrap">
                    <iframe class="detail-video" :src="video" title="Level verification video" frameborder="0" allowfullscreen></iframe>
                </div>
                <section class="detail-section">
                    <h2>Level information</h2>
                    <div class="detail-stats">
                        <div><span>Level ID</span><strong>{{ level.id || 'Not provided' }}</strong></div>
                        <div><span>Password</span><strong>{{ level.password || 'Free to Copy' }}</strong></div>
                        <div><span>Required percentage</span><strong>{{ rank <= 75 ? level.percentToQualify + '%' : rank <= 150 ? '100%' : 'Legacy' }}</strong></div>
                    </div>
                    <LevelAuthors :author="level.author || 'Unknown'" :creators="level.creators || []" :verifier="level.verifier || 'Unknown'"></LevelAuthors>
                </section>
                <section class="detail-section">
                    <h2>Records <span class="record-count">{{ records.length }}</span></h2>
                    <p class="records-note" v-if="rank <= 75">{{ level.percentToQualify }}% or better is required to qualify.</p>
                    <p class="records-note" v-else-if="rank <= 150">100% is required to qualify.</p>
                    <p class="records-note" v-else>This legacy level does not accept new records.</p>
                    <div v-if="records.length" class="detail-records">
                        <div class="detail-record detail-record-head"><span>Progress</span><span>Player</span><span>FPS</span></div>
                        <div class="detail-record" v-for="(record, index) in records" :key="record.user + '-' + index">
                            <strong>{{ record.percent }}%</strong>
                            <a :href="record.link" target="_blank" rel="noopener">{{ record.user }}</a>
                            <span>{{ record.hz }}Hz</span>
                        </div>
                    </div>
                    <p v-else class="empty-records">No records have been submitted for this level yet.</p>
                </section>
            </section>
            <aside class="detail-sidebar">
                <div class="sidebar-card">
                    <span class="sidebar-label">VERIFICATION</span>
                    <a :href="level.verification" target="_blank" rel="noopener">Watch verification video ↗</a>
                    <a v-if="level.showcase" :href="level.showcase" target="_blank" rel="noopener">Watch showcase ↗</a>
                </div>
                <div class="sidebar-card">
                    <span class="sidebar-label">ABOUT THIS LEVEL</span>
                    <p>Ranked #{{ rank }} on the SNAGD Extreme Demons list.</p>
                    <p>Records are reviewed by SNAGD staff before appearing on the list.</p>
                </div>
            </aside>
        </main>
        <main class="page-level-detail" v-else>
            <div class="detail-missing">
                <h1>Level not found</h1>
                <p>This level may have been removed or its data could not be loaded.</p>
                <router-link class="back-link" to="/">← Back to list</router-link>
            </div>
        </main>
    `,
    data: () => ({ list: [], loading: true, store }),
    computed: {
        entry() {
            return this.list.find(([level]) => level?.path === this.$route.params.path);
        },
        level() {
            return this.entry?.[0] || null;
        },
        rank() {
            return this.level ? this.list.findIndex(([level]) => level?.path === this.level.path) + 1 : 0;
        },
        records() {
            return this.level?.records || [];
        },
        video() {
            return this.level ? embed(this.level.verification) : '';
        },
    },
    async mounted() {
        this.list = await fetchList() || [];
        this.loading = false;
    },
};
