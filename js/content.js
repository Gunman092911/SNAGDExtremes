import { supabase } from './supabase.js';

import { round, score } from './score.js';

const dir = './data';

export async function fetchList() {
    const listResult = await fetch(`${dir}/_list.json`);
    try {
        const list = await listResult.json();
        const levels = await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        { ...level, path, records: [...(level.records || [])] },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );

        // Add newly verified levels created by authorized staff.
        try {
            const { data, error } = await supabase.from('snagd_levels')
                .select('level_key, id, name, verifier, verification, percent_to_qualify')
                .order('created_at', { ascending: true });
            if (error) throw error;
            for (const item of data || []) {
                if (levels.some(([level]) => level?.path === item.level_key)) continue;
                levels.push([{
                    id: item.id,
                    name: item.name,
                    author: '',
                    creators: [],
                    verifier: item.verifier,
                    verification: item.verification,
                    percentToQualify: item.percent_to_qualify,
                    password: [],
                    records: [],
                    path: item.level_key,
                }, null]);
            }
        } catch (error) {
            if (error.code !== '42P01' && error.code !== 'PGRST205') {
                console.warn('Could not load newly added levels:', error.message);
            }
        }

        // Approved community submissions are added to their matching level.
        try {
            const { data, error } = await supabase
                .from('snagd_submissions')
                .select('level_key, username, proof_url, percent, hz')
                .eq('status', 'approved');
            if (error) throw error;
            for (const submission of data || []) {
                const entry = levels.find(([level]) => level?.path === submission.level_key);
                if (!entry) continue;
                const records = entry[0].records;
                const duplicate = records.some(record =>
                    record.user?.toLowerCase() === submission.username.toLowerCase() &&
                    Number(record.percent) === Number(submission.percent) &&
                    record.link === submission.proof_url
                );
                if (!duplicate) {
                    records.push({
                        user: submission.username,
                        link: submission.proof_url,
                        percent: Number(submission.percent),
                        hz: Number(submission.hz),
                    });
                }
            }
        } catch (error) {
            console.warn('Could not load approved community submissions:', error.message);
        }

        // Apply the staff-managed order to every level on the public list.
        try {
            const { data: savedOrder, error } = await supabase
                .from('snagd_list_order')
                .select('level_key, position')
                .order('position', { ascending: true });
            if (error) throw error;
            if (savedOrder?.length) {
                const positions = new Map(savedOrder.map(item => [item.level_key, item.position]));
                levels.sort((a, b) => {
                    const aPosition = positions.has(a[0]?.path) ? positions.get(a[0].path) : Number.MAX_SAFE_INTEGER;
                    const bPosition = positions.has(b[0]?.path) ? positions.get(b[0].path) : Number.MAX_SAFE_INTEGER;
                    return aPosition - bPosition;
                });
            }
        } catch (error) {
            if (error.code !== '42P01' && error.code !== 'PGRST205') console.warn('Could not load custom level order:', error.message);
        }
        for (const [level] of levels) {
            if (level) level.records.sort((a, b) => Number(b.percent) - Number(a.percent));
        }
        return levels;
    } catch {
        console.error('Failed to load list.');
        return null;
    }
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${dir}/_editors.json`);
        return await editorsResults.json();
    } catch {
        return null;
    }
}

export async function fetchLeaderboard() {
    const list = await fetchList();
    const scoreMap = {};
    const errs = [];
    list.forEach(([level, err], rank) => {
        if (err) { errs.push(err); return; }
        const verifier = Object.keys(scoreMap).find(u => u.toLowerCase() === level.verifier.toLowerCase()) || level.verifier;
        scoreMap[verifier] ??= { verified: [], completed: [], progressed: [] };
        scoreMap[verifier].verified.push({
            rank: rank + 1,
            level: level.name,
            score: score(rank + 1, 100, level.percentToQualify),
            link: level.verification,
        });
        level.records.forEach(record => {
            const user = Object.keys(scoreMap).find(u => u.toLowerCase() === record.user.toLowerCase()) || record.user;
            scoreMap[user] ??= { verified: [], completed: [], progressed: [] };
            const { completed, progressed } = scoreMap[user];
            if (record.percent === 100) {
                completed.push({ rank: rank + 1, level: level.name, score: score(rank + 1, 100, level.percentToQualify), link: record.link });
                return;
            }
            progressed.push({
                rank: rank + 1,
                level: level.name,
                percent: record.percent,
                score: score(rank + 1, record.percent, level.percentToQualify),
                link: record.link,
            });
        });
    });
    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed } = scores;
        const total = [verified, completed, progressed].flat().reduce((prev, cur) => prev + cur.score, 0);
        return { user, total: round(total), ...scores };
    });
    return [res.sort((a, b) => b.total - a.total), errs];
}
