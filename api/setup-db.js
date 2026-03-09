/**
 * One-time database setup endpoint.
 * Call with: POST /api/setup-db
 * Required header: x-setup-key: <value of SETUP_KEY env var>
 *
 * After running successfully, this endpoint can be removed.
 */
const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const setupKey = process.env.SETUP_KEY;
    if (!setupKey) return res.status(500).json({ error: 'SETUP_KEY env var not configured' });
    if (req.headers['x-setup-key'] !== setupKey) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        await sql`
            CREATE TABLE IF NOT EXISTS leaderboard (
                id          SERIAL PRIMARY KEY,
                player_id   VARCHAR(36)  NOT NULL,
                player_name VARCHAR(50)  NOT NULL,
                score       INTEGER      NOT NULL CHECK (score >= 0 AND score <= 99999),
                ip_hash     VARCHAR(64),
                created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        `;

        await sql`CREATE INDEX IF NOT EXISTS idx_leaderboard_score      ON leaderboard (score DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_leaderboard_player_id   ON leaderboard (player_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_leaderboard_ip_created  ON leaderboard (ip_hash, created_at)`;

        return res.status(200).json({ success: true, message: 'Database tables and indexes created.' });
    } catch (err) {
        console.error('Setup failed:', err);
        return res.status(500).json({ error: err.message });
    }
};
