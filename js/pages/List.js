import { store } from "../store.js";
import { supabase } from "../supabase.js";
import { embed } from "../util.js";
import { score } from "../score.js";
import { fetchEditors, fetchList } from "../content.js";

import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

const readStoredArray = key => {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
};

const roleIconMap = {
    owner: "crown",
    admin: "user-gear",
    helper: "user-shield",
    dev: "code",
    trial: "user-lock",
};

export default {
    components: { Spinner, LevelAuthors },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-list" :class="{ 'meta-collapsed': metaCollapsed }">
            <div class="list-container">
                <section class="list-tools" aria-label="Search and filter levels">
                    <label class="level-search"><span aria-hidden="true">⌕</span><input v-model.trim="searchQuery" type="search" aria-label="Search by level name, creator, verifier, or publisher" placeholder="Search levels, creators, verifiers, publishers..." /><button v-if="searchQuery" type="button" @click="searchQuery = ''">×</button></label>
                    <div class="filter-row">
                        <select v-model="placementFilter" aria-label="Placement"><option value="all">All placements</option><option value="top75">Main · #1–75</option><option value="extended">Extended · #76–150</option><option value="legacy">Legacy · #151+</option></select>
                        <select v-model="categoryFilter" aria-label="List category"><option value="all">All categories</option><option value="aredl">AREDL ranked</option><option value="idl">IDL ranked</option><option value="unranked">Unranked on both</option></select>
                        <select v-model="difficultyFilter" aria-label="Difficulty"><option value="all">All difficulties</option><option value="extreme">Extreme Demon</option><option value="other">Other / unspecified</option></select>
                    </div>
                    <div class="list-tool-actions">
                        <button type="button" :class="{ active: quickFilter === 'favorites' }" @click="quickFilter = quickFilter === 'favorites' ? 'all' : 'favorites'">☆ Favorites</button>
                        <button type="button" :class="{ active: quickFilter === 'recent' }" @click="quickFilter = quickFilter === 'recent' ? 'all' : 'recent'">Recently viewed</button>
                        <button type="button" @click="chooseRandomLevel">↝ Random</button>
                        <button type="button" :class="{ active: compactMode }" @click="compactMode = !compactMode">Compact</button>
                    </div>
                    <div class="jump-row"><label for="jump-to-rank">Jump to rank</label><input id="jump-to-rank" v-model.number="jumpRank" type="number" min="1" :max="list.length" placeholder="#" @keyup.enter="jumpToRank" /><button type="button" @click="jumpToRank">Go</button><span>{{ visibleList.length }} / {{ list.length }}</span></div>
                </section>
                <table class="list" :class="{ 'compact-list': compactMode }" v-if="list">
                    <tr v-for="item in visibleList" :key="item.level?.path || item.index">
                        <td class="rank">
                            <p v-if="item.index + 1 <= 150" class="type-label-lg">#{{ item.index + 1 }}</p>
                            <p v-else class="type-label-lg">Legacy</p>
                        </td>
                        <td class="level" :class="{ 'active': selected == item.index, 'error': !item.level }">
                            <button @click="setSelected(item.index)">
                                <span class="type-label-lg">{{ item.level?.name || 'Unable to load level' }}</span>
                                <small v-if="item.level?.aredlRank" class="aredl-rank-badge">AREDL #{{ item.level.aredlRank }}</small>
                                <small v-if="item.level?.idlRank" class="idl-rank-badge">IDL {{ item.level.idlTier }} #{{ item.level.idlRank }}</small>
                            </button>
                            <button v-if="item.level" class="favorite-toggle" type="button" :class="{ saved: favorites.includes(item.level.path) }" @click.stop="toggleFavorite(item.level.path)" :aria-label="favorites.includes(item.level.path) ? 'Remove favorite' : 'Add favorite'">{{ favorites.includes(item.level.path) ? '★' : '☆' }}</button>
                        </td>
                    </tr>
                </table>
                <p v-if="list && visibleList.length === 0" class="no-level-results">No levels match your search or filters.</p>
            </div>
            <div class="level-container" :style="levelBackgroundStyle">
                <button v-if="metaCollapsed" type="button" class="sidebar-edge-toggle collapsed" @click="metaCollapsed = false" aria-label="Expand sidebar" title="Expand sidebar">‹</button>
                <div class="level-background-image" aria-hidden="true"></div>
                <div class="level" v-if="level" :key="level.path">
                    <div class="level-heading"><h1>{{ level.name }}</h1><button class="detail-favorite" type="button" :class="{ saved: favorites.includes(level.path) }" @click="toggleFavorite(level.path)">{{ favorites.includes(level.path) ? '★ Saved' : '☆ Favorite' }}</button></div>
                    <div v-if="level.aredlRank || level.idlRank" class="aredl-placement-badges">
                        <span v-if="level.aredlRank" class="aredl-rank-badge">AREDL #{{ level.aredlRank }}</span>
                        <span v-if="level.idlRank" class="idl-rank-badge">IDL {{ level.idlTier }} #{{ level.idlRank }}</span>
                    </div>
                    <LevelAuthors :author="level.author" :creators="level.creators" :verifier="level.verifier" :publisher="level.publisher"></LevelAuthors>
                    <iframe class="video" id="videoframe" :src="video" frameborder="0"></iframe>
                    <ul class="stats">
                        <li>
                            <div class="type-title-sm">Points when completed</div>
                            <p>{{ score(selected + 1, 100, level.percentToQualify) }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">ID</div>
                            <p>{{ level.id }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">Password</div>
                            <p>{{ level.password || 'Free to Copy' }}</p>
                        </li>
                    </ul>
                    <section class="level-statistics"><div><strong>{{ level.records?.length || 0 }}</strong><span>Total records</span></div><div><strong>{{ level.records?.filter(record => Number(record.percent) === 100).length || 0 }}</strong><span>Victors</span></div><div><strong>{{ level.records?.filter(record => Number(record.percent) < 100).length || 0 }}</strong><span>Progress</span></div></section>
                    <p v-if="level.updatedAt || level.updated_at || level.lastUpdated" class="level-updated">Information updated {{ formatUpdated(level.updatedAt || level.updated_at || level.lastUpdated) }}</p>
                    <h2>Records</h2>
                    <p v-if="selected + 1 <= 75"><strong>{{ level.percentToQualify }}%</strong> or better to qualify</p>
                    <p v-else-if="selected +1 <= 150"><strong>100%</strong> or better to qualify</p>
                    <p v-else>This level does not accept new records.</p>
                    <table class="records interactive-records">
                        <thead><tr>
                            <th><button type="button" @click="sortRecords('percent')">Progress / points {{ recordSortKey === 'percent' ? (recordSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</button></th>
                            <th><button type="button" @click="sortRecords('id')">Player ID {{ recordSortKey === 'id' ? (recordSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</button></th>
                            <th><button type="button" @click="sortRecords('user')">Player {{ recordSortKey === 'user' ? (recordSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</button></th>
                            <th>Proof</th><th>Details</th>
                        </tr></thead>
                        <tbody>
                            <template v-for="record in sortedRecords" :key="recordKey(record)">
                                <tr class="record">
                                    <td class="percent"><strong>{{ record.percent }}%</strong><small>{{ score(selected + 1, record.percent, level.percentToQualify) }} pts</small></td>
                                    <td class="record-id">{{ record.playerId || record.player_id || record.accountId || record.account_id || '—' }}</td>
                                    <td class="user"><span class="player-avatar">{{ String(record.user || '?').slice(0, 1).toUpperCase() }}</span>
                                        <a v-if="record.profileUrl || record.profile_url || record.playerUrl || record.player_url" :href="record.profileUrl || record.profile_url || record.playerUrl || record.player_url" target="_blank" rel="noopener noreferrer" class="type-label-lg">{{ record.user }}</a>
                                        <span v-else class="type-label-lg">{{ record.user }}</span>
                                    </td>
                                    <td><a v-if="record.link" :href="record.link" target="_blank" rel="noopener noreferrer">Watch ↗</a><span v-else>—</span></td>
                                    <td><button type="button" class="record-expand" @click="toggleRecordDetails(record)" :aria-expanded="expandedRecordKey === recordKey(record)">{{ expandedRecordKey === recordKey(record) ? 'Hide' : 'View' }}</button></td>
                                </tr>
                                <tr v-if="expandedRecordKey === recordKey(record)" class="record-expanded"><td colspan="5">
                                    <span v-if="record.hz">FPS: {{ record.hz }}</span><span v-if="record.mobile">Mobile player</span>
                                    <span v-if="record.device">Device: {{ record.device }}</span>
                                    <span v-if="!record.hz && !record.mobile && !record.device">No additional record details.</span>
                                </td></tr>
                            </template>
                        </tbody>
                    </table>
                </div>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>(ノಠ益ಠ)ノ彡┻━┻</p>
                </div>
            </div>
            <div class="meta-container">
                <div class="meta">
                    <button type="button" class="sidebar-edge-toggle expanded" @click="metaCollapsed = true" aria-label="Collapse sidebar" title="Collapse sidebar">›</button>
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors">{{ error }}</p>
                    </div>
                    <div class="og">
                        <p class="type-label-md">Website layout made by <a href="https://tsl.pages.dev/" target="_blank">TheShittyList</a></p>
                    </div>
                    <template v-if="editors">
                        <h3>List Editors</h3>
                        <ol class="editors">
                            <li v-for="editor in editors">
                                <img :src="\`./assets/\${roleIconMap[editor.role]}\${store.dark ? '-dark' : ''}.svg\`" :alt="editor.role">
                                <a v-if="editor.link" class="type-label-lg link" target="_blank" :href="editor.link">{{ editor.name }}</a>
                                <p v-else>{{ editor.name }}</p>
                            </li>
                        </ol>
                    </template>
                    <h3>Submission Requirements</h3>
                    <p>Submit a public video of yourself completing the level in one continuous, uncut run. Accepted video platforms include YouTube, Twitch highlights, Vimeo, and Bilibili. Do not submit a regular Twitch VOD.</p>
                    <p><strong>Raw footage is required for every record.</strong> Include a shared Google Drive link to the original, unedited recording. Set its sharing access to “Anyone with the link”. YouTube links, private Drive links, compressed files, and livestreams are not valid raw footage.</p>
                    <p>The raw footage must be at least 30 FPS and have moderate-to-high video quality. It must include an audio track with isolated click sounds (microphone audio and nothing else). Barely audible clicks count as missing clicks and can result in rejection. Raw footage from livestreams, liveplays, or mobile devices is exempt from the isolated-click-track requirement, but isolated clicks are still recommended.</p>
                    <p>Do not skip the dropdown endscreen after completing the level. Skipping it can result in immediate rejection.</p>
                    <p>Complete the level on its currently accepted version. If you use a copy that is not already approved, including an LDM or bug-fixed copy, ask list staff before submitting it. Cosmetic edits to a level are not allowed without explicit staff approval.</p>
                    <p>Users of Mega Hack, Geode, and other mods or external programs may have additional requirements. Check the <a href="https://www.pointercrate.com/guidelines/miscellaneous/" target="_blank" rel="noopener">allowed mods and programs guidelines</a> before submitting.</p>
                    <p>For Geometry Dash versions before 2.2, the maximum allowed frame rate is 360 FPS and a readable in-game FPS counter must be enabled. There is no FPS cap for version 2.2 and newer.</p>
                    <p>If you record a liveplay (for example, with a phone camera), make sure the game screen is clearly visible. Two-player records must include a handcam showing both players’ inputs.</p>
                    <p>Only submit your own records. Joke submissions may result in your ability to submit records being removed. Staff may ask for extra proof or clarification before accepting a record.</p>
                    <p>These requirements are adapted from <a href="https://www.pointercrate.com/guidelines/index/" target="_blank" rel="noopener">Pointercrate’s player checklist</a> and <a href="https://www.pointercrate.com/guidelines/records/" target="_blank" rel="noopener">record submission rules</a>.</p>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        list: [],
        editors: [],
        loading: true,
        selected: 0,
        searchQuery: '',
        placementFilter: 'all',
        categoryFilter: 'all',
        difficultyFilter: 'all',
        quickFilter: 'all',
        compactMode: false,
        metaCollapsed: false,
        jumpRank: '',
        favorites: readStoredArray('snagd-favorites'),
        recentlyViewed: readStoredArray('snagd-recent-levels'),
        recordSortKey: 'percent',
        recordSortDirection: 'desc',
        expandedRecordKey: null,
        errors: [],
        removedRecordsChannel: null,
        aredlRefreshInterval: null,
        idlRefreshInterval: null,
        roleIconMap,
        store
    }),
    watch: {
        visibleList(items) {
            if (items.length && !items.some(item => item.index === this.selected)) this.setSelected(items[0].index);
        },
    },
    computed: {
        level() {
            return this.list[this.selected]?.[0] || null;
        },
        sortedRecords() {
            const records = [...(this.level?.records || [])];
            const direction = this.recordSortDirection === 'asc' ? 1 : -1;
            return records.sort((a, b) => {
                const get = record => this.recordSortKey === 'percent' ? Number(record.percent) : this.recordSortKey === 'id' ? Number(record.playerId || record.player_id || record.accountId || record.account_id || 0) : String(record.user || '').toLowerCase();
                const av = get(a), bv = get(b);
                return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * direction;
            });
        },
        visibleList() {
            const query = this.searchQuery.toLowerCase();
            return this.list.map(([level, err], index) => ({ level, err, index })).filter(item => {
                const level = item.level;
                if (!level) return false;
                const searchable = [level.name, level.author, ...(level.creators || []), level.verifier, level.publisher].join(' ').toLowerCase();
                if (query && !searchable.includes(query)) return false;
                if (this.placementFilter === 'top75' && item.index + 1 > 75) return false;
                if (this.placementFilter === 'extended' && (item.index + 1 < 76 || item.index + 1 > 150)) return false;
                if (this.placementFilter === 'legacy' && item.index + 1 <= 150) return false;
                if (this.categoryFilter === 'aredl' && !level.aredlRank) return false;
                if (this.categoryFilter === 'idl' && !level.idlRank) return false;
                if (this.categoryFilter === 'unranked' && (level.aredlRank || level.idlRank)) return false;
                const difficulty = String(level.difficulty || level.demonDifficulty || '').toLowerCase();
                if (this.difficultyFilter === 'extreme' && difficulty && !difficulty.includes('extreme')) return false;
                if (this.difficultyFilter === 'other' && (!difficulty || difficulty.includes('extreme'))) return false;
                if (this.quickFilter === 'favorites' && !this.favorites.includes(level.path)) return false;
                if (this.quickFilter === 'recent' && !this.recentlyViewed.includes(level.path)) return false;
                return true;
            });
        },
        levelBackgroundStyle() {
            const url = this.level?.background_image || this.youtubeThumbnail(this.level?.verification);
            return url ? { '--level-background-image': 'url("' + url.replace(/["\\\\]/g, '') + '")' } : {};
        },
        video() {
            if (!this.level.showcase) {
                return embed(this.level.verification);
            }

            return embed(
                this.toggledShowcase
                    ? this.level.showcase
                    : this.level.verification
            );
        },
    },
    async mounted() {
        // Hide loading spinner
        this.list = await fetchList();
        this.editors = await fetchEditors();

        // Error handling
        if (!this.list) {
            this.errors = [
                "Failed to load list. Retry in a few minutes or notify list staff.",
            ];
        } else {
            this.errors.push(
                ...this.list
                    .filter(([_, err]) => err)
                    .map(([_, err]) => {
                        return `Failed to load level. (${err}.json)`;
                    })
            );
            if (!this.editors) {
                this.errors.push("Failed to load list editors.");
            }
        }

        this.loading = false;
        if (this.level?.path) this.setSelected(this.selected);

        // Refresh AREDL placements on load and every 15 minutes.
        await Promise.all([this.refreshAredlRanks(), this.refreshIdlRanks()]);
        this.aredlRefreshInterval = setInterval(() => this.refreshAredlRanks(), 15 * 60 * 1000);
        this.idlRefreshInterval = setInterval(() => this.refreshIdlRanks(), 15 * 60 * 1000);

        // Keep every already-open public list synchronized with staff removals.
        this.removedRecordsChannel = supabase
            .channel('public-list-removed-records')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'snagd_removed_records',
            }, async () => {
                const selectedPath = this.level?.path;
                const updatedList = await fetchList();
                if (!updatedList) return;
                this.list = updatedList;
                const newSelectedIndex = updatedList.findIndex(([level]) => level?.path === selectedPath);
                this.selected = newSelectedIndex >= 0 ? newSelectedIndex : 0;
            })
            .subscribe();
    },
    beforeUnmount() {
        if (this.aredlRefreshInterval) {
            clearInterval(this.aredlRefreshInterval);
            this.aredlRefreshInterval = null;
        }
        if (this.idlRefreshInterval) {
            clearInterval(this.idlRefreshInterval);
            this.idlRefreshInterval = null;
        }
        if (this.removedRecordsChannel) {
            supabase.removeChannel(this.removedRecordsChannel);
            this.removedRecordsChannel = null;
        }
    },
    methods: {
        async refreshAredlRanks() {
            try {
                const response = await fetch('https://api.aredl.net/v2/api/aredl/levels', {
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) throw new Error('AREDL API returned ' + response.status);
                const payload = await response.json();
                const aredlLevels = Array.isArray(payload)
                    ? payload
                    : (payload.data || payload.levels || payload.items || payload.results || []);
                if (!Array.isArray(aredlLevels) || aredlLevels.length === 0) {
                    throw new Error('AREDL API returned an unexpected or empty level list');
                }

                const rankById = new Map();
                const rankByName = new Map();
                const normalizeName = value => String(value || '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '');

                for (const item of aredlLevels) {
                    // AREDL's "id" is its internal UUID; "level_id" is the Geometry Dash ID.
                    const gameId = item.level_id ?? item.gd_level_id ?? item.gd_id ?? item.levelId ?? item.id;
                    const rank = Number(item.position ?? item.rank ?? item.placement);
                    if (!Number.isFinite(rank) || rank <= 0) continue;

                    if (gameId !== null && gameId !== undefined) {
                        rankById.set(String(gameId), rank);
                    }
                    const name = normalizeName(item.name ?? item.title ?? item.level_name);
                    if (name) rankByName.set(name, rank);
                }

                let matched = 0;
                this.list = this.list.map(([level, err]) => {
                    if (!level) return [level, err];
                    const byId = rankById.get(String(level.id));
                    const byName = rankByName.get(normalizeName(level.name));
                    const rank = byId ?? byName ?? null;
                    if (rank !== null) matched++;
                    return [{ ...level, aredlRank: rank }, err];
                });
                console.info('AREDL placements loaded:', matched, 'of', this.list.length, 'SNAGD levels matched.');
            } catch (error) {
                console.warn('Could not refresh AREDL placements:', error);
            }
        },
        async refreshIdlRanks() {
            try {
                // Prefer our same-origin snapshot, refreshed automatically by GitHub Actions.
                let response = await fetch('./data/idl-levels.json', { cache: 'no-cache' });
                if (!response.ok) {
                    // Fallback keeps the feature usable if the scheduled snapshot is not available yet.
                    response = await fetch('https://insanedemonlist.com/api/levels', {
                        headers: { Accept: 'application/json' },
                        cache: 'no-cache',
                    });
                }
                if (!response.ok) throw new Error('IDL data returned ' + response.status);
                const payload = await response.json();
                const idlLevels = Array.isArray(payload)
                    ? payload
                    : (payload.data || payload.levels || payload.items || payload.results || []);
                if (!Array.isArray(idlLevels) || idlLevels.length === 0) {
                    throw new Error('IDL API returned an unexpected or empty level list');
                }

                const normalizeName = value => String(value || '')
                    .toLowerCase()
                    .replace(/\([^)]*\)/g, ' ')
                    .replace(/[^a-z0-9]/g, '');
                const rankByName = new Map();
                for (const item of idlLevels) {
                    const rank = Number(item.position ?? item.rank ?? item.placement);
                    const name = normalizeName(item.name ?? item.title ?? item.level_name);
                    if (name && Number.isFinite(rank) && rank > 0) {
                        rankByName.set(name, rank);
                    }
                }

                let matched = 0;
                this.list = this.list.map(([level, err]) => {
                    if (!level) return [level, err];
                    const rank = rankByName.get(normalizeName(level.name)) ?? null;
                    if (rank !== null) matched++;
                    const idlTier = rank === null
                        ? null
                        : rank <= 75 ? 'Main'
                        : rank <= 150 ? 'Extended'
                        : 'Legacy';
                    return [{ ...level, idlRank: rank, idlTier }, err];
                });
                console.info('IDL placements loaded:', matched, 'of', this.list.length, 'SNAGD levels matched.');
            } catch (error) {
                console.warn('Could not refresh IDL placements:', error);
            }
        },
        setSelected(index) {
            if (!this.list[index]?.[0]) return;
            this.selected = index;
            const path = this.list[index][0].path;
            this.recentlyViewed = [path, ...this.recentlyViewed.filter(item => item !== path)].slice(0, 8);
            localStorage.setItem('snagd-recent-levels', JSON.stringify(this.recentlyViewed));
        },
        toggleFavorite(path) {
            this.favorites = this.favorites.includes(path) ? this.favorites.filter(item => item !== path) : [...this.favorites, path];
            localStorage.setItem('snagd-favorites', JSON.stringify(this.favorites));
        },
        chooseRandomLevel() {
            const choices = this.visibleList.filter(item => item.level);
            if (choices.length) this.setSelected(choices[Math.floor(Math.random() * choices.length)].index);
        },
        jumpToRank() {
            const rank = Number(this.jumpRank);
            if (!Number.isInteger(rank) || rank < 1 || rank > this.list.length) return;
            this.setSelected(rank - 1);
            this.searchQuery = ''; this.placementFilter = 'all'; this.categoryFilter = 'all'; this.quickFilter = 'all';
        },
        formatUpdated(value) {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
        },
        recordKey(record) {
            return JSON.stringify([record.user || '', record.link || '', record.percent || 0, record.hz || 0]);
        },
        toggleRecordDetails(record) {
            const key = this.recordKey(record);
            this.expandedRecordKey = this.expandedRecordKey === key ? null : key;
        },
        sortRecords(key) {
            if (this.recordSortKey === key) this.recordSortDirection = this.recordSortDirection === 'asc' ? 'desc' : 'asc';
            else { this.recordSortKey = key; this.recordSortDirection = key === 'user' ? 'asc' : 'desc'; }
        },
        youtubeThumbnail(url) {
            if (!url) return '';
            try {
                const parsed = new URL(url);
                let id = '';
                if (parsed.hostname.includes('youtu.be')) id = parsed.pathname.slice(1);
                else if (parsed.hostname.includes('youtube.com')) id = parsed.searchParams.get('v') || '';
                return id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : '';
            } catch { return ''; }
        },
        embed,
        score,
    },
};
