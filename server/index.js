/**
 * Braitenberg Vehicles Backend Server
 *
 * Express + SQLite backend for user accounts, scenario progress, and leaderboards.
 * Designed to run on a local machine and be exposed via Cloudflare Tunnel.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3001;

// Admin emails — these users get admin role automatically
const ADMIN_EMAILS = ['eyaniv1@gmail.com'];

// ── Middleware ──────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve the frontend
app.use(express.static(path.join(__dirname, '..', 'simulation')));

// ── Database setup ─────────────────────────────────────────

const DB_PATH = path.join(__dirname, 'vehicles.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        nickname TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_scenarios (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scenario_id TEXT NOT NULL,
        best_time REAL,
        best_vehicle_config TEXT,
        last_vehicle_config TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_user_scenarios_user ON user_scenarios(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_scenarios_scenario ON user_scenarios(scenario_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_scenario_pair ON user_scenarios(user_id, scenario_id);
`);

// ── Prepared statements ────────────────────────────────────

const stmts = {
    getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (id, email, nickname, role) VALUES (?, ?, ?, ?)'),

    getUserScenarios: db.prepare('SELECT * FROM user_scenarios WHERE user_id = ?'),
    getUserScenario: db.prepare('SELECT * FROM user_scenarios WHERE user_id = ? AND scenario_id = ?'),

    insertUserScenario: db.prepare(`
        INSERT INTO user_scenarios (id, user_id, scenario_id, best_time, best_vehicle_config, last_vehicle_config, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `),

    updateBestAndLast: db.prepare(`
        UPDATE user_scenarios
        SET best_time = ?, best_vehicle_config = ?, last_vehicle_config = ?, updated_at = datetime('now')
        WHERE user_id = ? AND scenario_id = ?
    `),

    updateLastOnly: db.prepare(`
        UPDATE user_scenarios
        SET last_vehicle_config = ?, updated_at = datetime('now')
        WHERE user_id = ? AND scenario_id = ?
    `),

    updateBestTime: db.prepare(`
        UPDATE user_scenarios
        SET best_time = ?, best_vehicle_config = ?, last_vehicle_config = ?, updated_at = datetime('now')
        WHERE user_id = ? AND scenario_id = ?
    `),

    getLeaderboard: db.prepare(`
        SELECT us.best_time, u.nickname, u.id as user_id
        FROM user_scenarios us
        JOIN users u ON us.user_id = u.id
        WHERE us.scenario_id = ? AND us.best_time IS NOT NULL
        ORDER BY us.best_time ASC
        LIMIT 50
    `),
};

// ── Auth middleware ─────────────────────────────────────────

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    const userId = authHeader.slice(7);
    const user = stmts.getUserById.get(userId);
    if (!user) {
        return res.status(401).json({ error: 'Invalid user' });
    }
    req.user = user;
    next();
}

function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ── API Routes: Auth ───────────────────────────────────────

app.post('/api/login', (req, res) => {
    const { email, nickname } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = email.trim().toLowerCase();
    let user = stmts.getUserByEmail.get(normalizedEmail);

    if (user) {
        // Existing user — return them
        return res.json({ user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role } });
    }

    // New user — create account
    if (!nickname || !nickname.trim()) {
        return res.status(400).json({ error: 'Nickname is required for new accounts', needsNickname: true });
    }

    const id = uuidv4();
    const role = ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : 'user';
    stmts.insertUser.run(id, normalizedEmail, nickname.trim(), role);
    user = stmts.getUserById.get(id);

    res.status(201).json({ user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role } });
});

// ── API Routes: User Scenarios ─────────────────────────────

app.get('/api/my-scenarios', authMiddleware, (req, res) => {
    const rows = stmts.getUserScenarios.all(req.user.id);
    const result = {};
    for (const row of rows) {
        result[row.scenario_id] = {
            best_time: row.best_time,
            best_vehicle_config: row.best_vehicle_config ? JSON.parse(row.best_vehicle_config) : null,
            last_vehicle_config: row.last_vehicle_config ? JSON.parse(row.last_vehicle_config) : null,
        };
    }
    res.json(result);
});

app.post('/api/scenarios/:id/attempt', authMiddleware, (req, res) => {
    const scenarioId = req.params.id;
    const { time, vehicle_config } = req.body;
    const configJson = vehicle_config ? JSON.stringify(vehicle_config) : null;

    const existing = stmts.getUserScenario.get(req.user.id, scenarioId);

    if (!existing) {
        // First attempt on this scenario
        stmts.insertUserScenario.run(
            uuidv4(), req.user.id, scenarioId,
            time || null, // null if not a win
            time ? configJson : null, // best config only on win
            configJson // last config always
        );
    } else if (time && (!existing.best_time || time < existing.best_time)) {
        // New best time
        stmts.updateBestTime.run(time, configJson, configJson, req.user.id, scenarioId);
    } else {
        // Not a new best — just update last config
        stmts.updateLastOnly.run(configJson, req.user.id, scenarioId);
    }

    res.json({ ok: true });
});

// ── API Routes: Leaderboard ────────────────────────────────

app.get('/api/scenarios/:id/leaderboard', (req, res) => {
    const rows = stmts.getLeaderboard.all(req.params.id);
    res.json(rows.map((row, i) => ({
        rank: i + 1,
        nickname: row.nickname,
        best_time: row.best_time,
        is_you: false, // client will set this
        user_id: row.user_id,
    })));
});

// ── API Routes: Admin User Management ──────────────────────

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    const users = db.prepare('SELECT id, email, nickname, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
});

app.get('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const user = stmts.getUserById.get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const scenarios = stmts.getUserScenarios.all(req.params.id);
    const scenarioData = scenarios.map(s => ({
        scenario_id: s.scenario_id,
        best_time: s.best_time,
        best_vehicle_config: s.best_vehicle_config ? JSON.parse(s.best_vehicle_config) : null,
        last_vehicle_config: s.last_vehicle_config ? JSON.parse(s.last_vehicle_config) : null,
        updated_at: s.updated_at,
    }));

    res.json({
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        created_at: user.created_at,
        scenarios: scenarioData,
    });
});

app.delete('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    const { user_ids } = req.body;
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ error: 'user_ids array required' });
    }
    // Prevent deleting yourself
    if (user_ids.includes(req.user.id)) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const deleteMany = db.transaction((ids) => {
        const delScenarios = db.prepare('DELETE FROM user_scenarios WHERE user_id = ?');
        const delUser = db.prepare('DELETE FROM users WHERE id = ?');
        for (const id of ids) {
            delScenarios.run(id);
            delUser.run(id);
        }
    });
    deleteMany(user_ids);
    res.json({ ok: true, deleted: user_ids.length });
});

// Export a user's full record
app.get('/api/admin/users/:id/export', authMiddleware, adminMiddleware, (req, res) => {
    const user = stmts.getUserById.get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const scenarios = stmts.getUserScenarios.all(req.params.id);
    const exportData = {
        _export_version: 1,
        _exported_at: new Date().toISOString(),
        user: {
            email: user.email,
            nickname: user.nickname,
            role: user.role,
            created_at: user.created_at,
        },
        scenarios: scenarios.map(s => ({
            scenario_id: s.scenario_id,
            best_time: s.best_time,
            best_vehicle_config: s.best_vehicle_config ? JSON.parse(s.best_vehicle_config) : null,
            last_vehicle_config: s.last_vehicle_config ? JSON.parse(s.last_vehicle_config) : null,
        })),
    };
    res.json(exportData);
});

// Import a user record
app.post('/api/admin/users/import', authMiddleware, adminMiddleware, (req, res) => {
    const data = req.body;
    if (!data || !data.user || !data.user.email) {
        return res.status(400).json({ error: 'Invalid import data' });
    }

    const normalizedEmail = data.user.email.trim().toLowerCase();
    let user = stmts.getUserByEmail.get(normalizedEmail);

    if (!user) {
        // Create user
        const id = uuidv4();
        const role = ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : (data.user.role || 'user');
        stmts.insertUser.run(id, normalizedEmail, data.user.nickname || normalizedEmail, role);
        user = stmts.getUserById.get(id);
    }

    // Import scenarios
    if (Array.isArray(data.scenarios)) {
        for (const s of data.scenarios) {
            const existing = stmts.getUserScenario.get(user.id, s.scenario_id);
            const bestConfig = s.best_vehicle_config ? JSON.stringify(s.best_vehicle_config) : null;
            const lastConfig = s.last_vehicle_config ? JSON.stringify(s.last_vehicle_config) : null;

            if (!existing) {
                stmts.insertUserScenario.run(
                    uuidv4(), user.id, s.scenario_id,
                    s.best_time || null, bestConfig, lastConfig
                );
            } else {
                // Update if imported time is better
                if (s.best_time && (!existing.best_time || s.best_time < existing.best_time)) {
                    stmts.updateBestTime.run(s.best_time, bestConfig, lastConfig, user.id, s.scenario_id);
                }
            }
        }
    }

    res.json({ ok: true, user_id: user.id });
});

// ── Health check ───────────────────────────────────────────

app.get('/api/health', (req, res) => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    res.json({ status: 'ok', users: userCount });
});

// ── Start server ───────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`Vehicles backend running on http://localhost:${PORT}`);
    console.log(`Database: ${DB_PATH}`);
});
