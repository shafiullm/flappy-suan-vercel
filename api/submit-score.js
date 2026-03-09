const { sql } = require('@vercel/postgres');
const crypto = require('crypto');

const ALLOWED_NAME_RE = /^[a-zA-Z0-9 '_\-\.]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SCORE = 99999;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 5;

function getOrigin(req) {
    if (process.env.ALLOWED_ORIGIN) return process.env.ALLOWED_ORIGIN;
    const host = req.headers['host'] || '';
    return `https://${host}`;
}

module.exports = async function handler(req, res) {
    const origin = getOrigin(req);
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }
    if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid request body' });

    const { playerName, playerUID, score } = body;

    // Validate name
    if (typeof playerName !== 'string') return res.status(400).json({ error: 'Invalid name' });
    const cleanName = playerName.trim();
    if (cleanName.length < 1 || cleanName.length > 30) {
        return res.status(400).json({ error: 'Name must be 1-30 characters' });
    }
    if (!ALLOWED_NAME_RE.test(cleanName)) {
        return res.status(400).json({ error: 'Name contains invalid characters' });
    }

    // Validate UID
    if (typeof playerUID !== 'string' || !UUID_RE.test(playerUID)) {
        return res.status(400).json({ error: 'Invalid player ID' });
    }

    // Validate score
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
        return res.status(400).json({ error: 'Invalid score' });
    }

    // Hash IP for rate limiting and privacy
    const rawIP = ((req.headers['x-forwarded-for'] || '').split(',')[0].trim())
        || (req.socket && req.socket.remoteAddress)
        || 'unknown';
    const salt = process.env.IP_SALT || 'flappy-suan-salt';
    const ipHash = crypto.createHash('sha256').update(rawIP + salt).digest('hex');

    // Rate limiting: max RATE_LIMIT_MAX submissions per IP per window
    try {
        const { rows: rateLimitRows } = await sql`
            SELECT COUNT(*)::int AS count
            FROM leaderboard
            WHERE ip_hash = ${ipHash}
              AND created_at > NOW() - (${String(RATE_LIMIT_WINDOW_SECONDS)} || ' seconds')::interval
        `;
        if (rateLimitRows[0].count >= RATE_LIMIT_MAX) {
            return res.status(429).json({ error: 'Too many submissions. Please wait a moment.' });
        }
    } catch (err) {
        console.error('Rate limit check failed:', err);
        // On DB error, fail open to not block players
    }

    // Insert score
    try {
        await sql`
            INSERT INTO leaderboard (player_id, player_name, score, ip_hash)
            VALUES (${playerUID}, ${cleanName}, ${score}, ${ipHash})
        `;
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Insert score failed:', err);
        return res.status(500).json({ error: 'Failed to save score' });
    }
};
