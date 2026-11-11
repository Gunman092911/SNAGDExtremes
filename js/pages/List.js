import { store } from "../main.js";
import { supabase } from "../supabase.js";
import { embed } from "../util.js";
import { score } from "../score.js";
import { fetchEditors, fetchList } from "../content.js";

import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

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
        <main v-else class="page-list">
            <div class="list-container">
                <table class="list" v-if="list">
                    <tr v-for="([level, err], i) in list">
                        <td class="rank">
                            <p v-if="i + 1 <= 150" class="type-label-lg">#{{ i + 1 }}</p>
                            <p v-else class="type-label-lg">Legacy</p>
                        </td>
                        <td class="level" :class="{ 'active': selected == i, 'error': !level }">
                            <button @click="selected = i">
                                <span class="type-label-lg">{{ level?.name || \`Error (\${err}.json)\` }}</span>
                                <small v-if="level?.aredlRank" class="aredl-rank-badge">AREDL #{{ level.aredlRank }}</small>
                            </button>
                        </td>
                    </tr>
                </table>
            </div>
            <div class="level-container" :style="levelBackgroundStyle">
                <div class="level-background-image" aria-hidden="true"></div>
                <div class="level" v-if="level">
                    <h1>{{ level.name }}</h1>
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
                    <h2>Records</h2>
                    <p v-if="selected + 1 <= 75"><strong>{{ level.percentToQualify }}%</strong> or better to qualify</p>
                    <p v-else-if="selected +1 <= 150"><strong>100%</strong> or better to qualify</p>
                    <p v-else>This level does not accept new records.</p>
                    <table class="records">
                        <tr v-for="record in level.records" class="record">
                            <td class="percent">
                                <p>{{ record.percent }}%</p>
                            </td>
                            <td class="user">
                                <a :href="record.link" target="_blank" class="type-label-lg">{{ record.user }}</a>
                            </td>
                            <td class="mobile">
                                <img v-if="record.mobile" :src="\`./assets/phone-landscape\${store.dark ? '-dark' : ''}.svg\`" alt="Mobile">
                            </td>
                        </tr>
                    </table>
                </div>
                <div v-else class="level" style="height: 100%; justify-content: center; align-items: center;">
                    <p>(ノಠ益ಠ)ノ彡┻━┻</p>
                </div>
            </div>
            <div class="meta-container">
                <div class="meta">
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
        errors: [],
        removedRecordsChannel: null,\n        aredlRefreshInterval: null,
        roleIconMap,
        store
    }),
    computed: {
        level() {
            return this.list[this.selected][0];
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

        this.loading = false;\n\n        // Refresh AREDL placements on load and every 15 minutes.\n        await this.refreshAredlRanks();\n        this.aredlRefreshInterval = setInterval(() => this.refreshAredlRanks(), 15 * 60 * 1000);

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
        if (this.removedRecordsChannel) {
            supabase.removeChannel(this.removedRecordsChannel);
            this.removedRecordsChannel = null;
        }
    },
    methods: {
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
