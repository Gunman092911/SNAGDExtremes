// Refresh the official IDL placements for the SNAGD public list.
const endpoint = 'https://insanedemonlist.com/api/levels';
const response = await fetch(endpoint, {
    headers: { Accept: 'application/json', 'User-Agent': 'SNAGD-Extremes-IDL-Sync/1.0' },
});
if (!response.ok) throw new Error(`IDL API returned HTTP ${response.status}`);

const payload = await response.json();
const levels = Array.isArray(payload)
    ? payload
    : (payload.data || payload.levels || payload.items || payload.results || []);

if (!Array.isArray(levels) || levels.length < 150) {
    throw new Error('IDL API returned too few levels; refusing to overwrite the last good snapshot.');
}

const normalized = levels
    .map(level => ({
        id: level.id ?? null,
        name: String(level.name ?? level.title ?? level.level_name ?? '').trim(),
        position: Number(level.position ?? level.rank ?? level.placement),
    }))
    .filter(level => level.name && Number.isFinite(level.position) && level.position > 0)
    .sort((a, b) => a.position - b.position);

if (normalized.length < 150 || !normalized.some(level => level.position > 150)) {
    throw new Error('IDL response did not contain a valid Main/Extended/Legacy dataset; keeping the previous snapshot.');
}

await import('node:fs/promises').then(({ writeFile, mkdir }) =>
    mkdir('data', { recursive: true }).then(() =>
        writeFile('data/idl-levels.json', JSON.stringify({
            source: endpoint,
            updatedAt: new Date().toISOString(),
            levels: normalized,
        }, null, 2) + '\n')
    )
);
console.log(`Saved ${normalized.length} IDL placements, including Legacy entries.`);
