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

        // Apply staff-managed verifier changes to both built-in and staff-added levels.
        try {
            const { data: verifierOverrides, error } = await supabase
                .from('snagd_verifier_overrides')
                .select('level_key, verifier');
            if (error) throw error;
            const overrides = new Map((verifierOverrides || []).map(item => [item.level_key, item.verifier]));
            for (const [level] of levels) {
                if (level && overrides.has(level.path)) level.verifier = overrides.get(level.path);
            }
        } catch (error) {
            if (error.code !== '42P01' && error.code !== 'PGRST205') {
                console.warn('Could not load verifier overrides:', error.message);
            }
        }

        // Apply staff-managed YouTube video links to built-in and staff-added levels.
        try {
            const { data: videoOverrides, error } = await supabase
                .from('snagd_video_overrides')
                .select('level_key, verification');
            if (error) throw error;
            const overrides = new Map((videoOverrides || []).map(item => [item.level_key, item.verification]));
            for (const [level] of levels) {
                if (level && overrides.has(level.path)) level.verification = overrides.get(level.path);
            }
        } catch (error) {
            if (error.code !== '42P01' && error.code !== 'PGRST205') {
                console.warn('Could not load YouTube video overrides:', error.message);
            }
        }

        // Hide records that staff have removed from the public list.
        try {
            const { data: removedRecords, error } = await supabase
                .from('snagd_removed_records')
                .select('level_key, username, proof_url, percent, hz');
            if (error) throw error;
            for (const [level] of levels) {
                if (!level) continue;
                const removed = (removedRecords || []).filter(item => item.level_key === level.path);
                level.records = level.records.filter(record => !removed.some(item =>
                    item.username.toLowerCase() === String(record.user || '').toLowerCase() &&
                    item.proof_url === record.link &&
                    Number(item.percent) === Number(record.percent) &&
                    Number(item.hz) === Number(record.hz)
                ));
            }
        } catch (error) {
            if (error.code !== '42P01' && error.code !== 'PGRST205') {
                console.warn('Could not load removed records:', error.message);
            }
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
                if (!level || !orderByLevel.has(level.path)) continue;
                const savedKeys = orderByLevel.get(level.path);
                const positions = new Map(savedKeys.map((key, index) => [key, index]));
                const recordKey = record => JSON.stringify([
                    String(record.user || ''),
                    String(record.link || ''),
                    Number(record.percent),
                    Number(record.hz),
                ]);
                level.records.sort((a, b) => {
                    const aPosition = positions.has(recordKey(a)) ? positions.get(recordKey(a)) : Number.MAX_SAFE_INTEGER;
                    const bPosition = positions.has(recordKey(b)) ? positions.get(recordKey(b)) : Number.MAX_SAFE_INTEGER;
                    return aPosition - bPosition;
                });
            }
        } catch (error) {
            if (error.code !== '42P01' && error.code !== 'PGRST205') {
                console.warn('Could not load custom record order:', error.message);
            }
        }

        for (const [level] of levels) {
            if (level) level.records.sort((a, b) => Number(b.percent) - Number(a.percent));
        }

        // Apply staff-managed record order within each level.
        try {
            const { data: recordOrders, error } = await supabase
                .from('snagd_record_order')
                .select('level_key, record_order');
            if (error) throw error;
            const orderByLevel = new Map((recordOrders || []).map(item => [item.level_key, item.record_order || []]));
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
