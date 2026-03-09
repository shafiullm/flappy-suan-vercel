const { sql } = require('@vercel/postgres');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getOrigin(req) {
    if (process.env.ALLOWED_ORIGIN) return process.env.ALLOWED_ORIGIN;
    const host = req.headers['host'] || '';
    return `https://${host}`;
}

module.exports = async function handler(req, res) {
    const origin = getOrigin(req);
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const uid = typeof req.query.uid === 'string' ? req.query.uid : null;

    try {
        // Top 5 scores (multiple entries per player allowed)
        const { rows: top5 } = await sql`
            SELECT player_name, score, player_id
            FROM leaderboard
            ORDER BY score DESC
            LIMIT 5
        `;

        // Personal best for the requesting player
        let personalBest = null;
        if (uid && UUID_RE.test(uid)) {
            const { rows: pbRows } = await sql`
                SELECT MAX(score)::int AS best
                FROM leaderboard
                WHERE player_id = ${uid}
            `;
            if (pbRows.length > 0 && pbRows[0].best !== null) {
                personalBest = pbRows[0].best;
            }
        }

        return res.status(200).json({
            top5: top5.map(r => ({
                playerName: r.player_name,
                score: parseInt(r.score),
                playerId: r.player_id,
            })),
            personalBest,
        });
    } catch (err) {
        console.error('Leaderboard fetch failed:', err);
        return res.status(500).json({ error: 'Failed to load leaderboard' });
    }
};
