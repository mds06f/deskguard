const express = require('express');
const router = express.Router();
const { getDatabase } = require('./db');

let broadcastFn = () => {};

function setBroadcaster(fn) {
  broadcastFn = fn;
}

function getSessionDuration() {
  return 2 * 60 * 60;
}

function getAwayDuration() {
  return 20 * 60;
}

router.get('/desks', async (req, res) => {
  try {
    const db = await getDatabase();
    const desks = await db.all('SELECT * FROM desks');
    const activeSessions = await db.all("SELECT * FROM sessions WHERE status = 'active'");
    
    const data = desks.map(desk => {
      const session = activeSessions.find(s => s.desk_id === desk.id);
      return {
        ...desk,
        session: session ? {
          id: session.id,
          studentId: session.student_id,
          startedAt: session.started_at,
          expiresAt: session.expires_at,
          awayExpiresAt: session.away_expires_at,
          prompted: session.prompted === 1,
          promptedAt: session.prompted_at
        } : null
      };
    });
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/desks/:id/checkin', async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' });
  }

  try {
    const db = await getDatabase();
    const desk = await db.get('SELECT * FROM desks WHERE id = ?', id);

    if (!desk) {
      return res.status(404).json({ error: 'Desk not found' });
    }

    if (desk.status !== 'free') {
      return res.status(400).json({ error: 'Desk is already occupied or away' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + getSessionDuration() * 1000).toISOString();

    await db.run("UPDATE sessions SET status = 'completed' WHERE desk_id = ? AND status = 'active'", id);
    const result = await db.run(
      `INSERT INTO sessions (desk_id, student_id, started_at, expires_at, status) 
       VALUES (?, ?, ?, ?, 'active')`,
      id, studentId, now.toISOString(), expiresAt
    );

    await db.run('UPDATE desks SET status = ? WHERE id = ?', 'occupied', id);

    broadcastFn();
    res.json({ success: true, sessionId: result.lastID, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/desks/:id/away', async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDatabase();
    const desk = await db.get('SELECT * FROM desks WHERE id = ?', id);

    if (!desk) return res.status(404).json({ error: 'Desk not found' });
    if (desk.status !== 'occupied') {
      return res.status(400).json({ error: 'Only occupied desks can be set to Away' });
    }

    const session = await db.get("SELECT * FROM sessions WHERE desk_id = ? AND status = 'active'", id);
    if (!session) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    const now = new Date();
    const remainingMs = new Date(session.expires_at) - now;
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    const awayExpiresAt = new Date(now.getTime() + getAwayDuration() * 1000).toISOString();

    await db.run(
      `UPDATE sessions 
       SET away_expires_at = ?, remaining_seconds = ? 
       WHERE id = ?`,
      awayExpiresAt, remainingSeconds, session.id
    );

    await db.run("UPDATE desks SET status = 'away' WHERE id = ?", id);

    broadcastFn();
    res.json({ success: true, awayExpiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/desks/:id/back', async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDatabase();
    const desk = await db.get('SELECT * FROM desks WHERE id = ?', id);

    if (!desk) return res.status(404).json({ error: 'Desk not found' });
    if (desk.status !== 'away') {
      return res.status(400).json({ error: 'Desk is not in Away status' });
    }

    const session = await db.get("SELECT * FROM sessions WHERE desk_id = ? AND status = 'active'", id);
    if (!session) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    const now = new Date();
    const remainingSeconds = session.remaining_seconds != null ? session.remaining_seconds : getSessionDuration();
    const expiresAt = new Date(now.getTime() + remainingSeconds * 1000).toISOString();

    await db.run(
      `UPDATE sessions 
       SET away_expires_at = NULL, remaining_seconds = NULL, expires_at = ?, prompted = 0, prompted_at = NULL 
       WHERE id = ?`,
      expiresAt, session.id
    );

    await db.run("UPDATE desks SET status = 'occupied' WHERE id = ?", id);

    broadcastFn();
    res.json({ success: true, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/desks/:id/ping', async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDatabase();
    const session = await db.get("SELECT * FROM sessions WHERE desk_id = ? AND status = 'active'", id);

    if (!session) {
      return res.status(404).json({ error: 'No active session found for this desk' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + getSessionDuration() * 1000).toISOString();

    await db.run(
      `UPDATE sessions 
       SET prompted = 0, prompted_at = NULL, expires_at = ? 
       WHERE id = ?`,
      expiresAt, session.id
    );

    await db.run("UPDATE desks SET status = 'occupied' WHERE id = ?", id);

    broadcastFn();
    res.json({ success: true, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/desks/:id/checkout', async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDatabase();
    
    await db.run(
      "UPDATE sessions SET status = 'completed' WHERE desk_id = ? AND status = 'active'",
      id
    );

    await db.run("UPDATE desks SET status = 'free' WHERE id = ?", id);

    broadcastFn();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/desks/:id/reset', async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDatabase();
    
    await db.run(
      "UPDATE sessions SET status = 'abandoned' WHERE desk_id = ? AND status = 'active'",
      id
    );

    await db.run("UPDATE desks SET status = 'free' WHERE id = ?", id);

    broadcastFn();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const db = await getDatabase();
    
    const stats = await db.get(`
      SELECT 
        COUNT(CASE WHEN status = 'free' THEN 1 END) as free,
        COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
        COUNT(CASE WHEN status = 'away' THEN 1 END) as away,
        COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned,
        COUNT(*) as total
      FROM desks
    `);

    const abandonedCountResult = await db.get("SELECT COUNT(*) as count FROM sessions WHERE status = 'abandoned'");
    const rawCount = abandonedCountResult ? abandonedCountResult.count : 0;
    const hoursSaved = (rawCount * 1.5).toFixed(1);

    res.json({
      free: stats.free || 0,
      occupied: stats.occupied || 0,
      away: stats.away || 0,
      abandoned: stats.abandoned || 0,
      total: stats.total || 0,
      hoursSaved: parseFloat(hoursSaved)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics/full', async (req, res) => {
  try {
    const db = await getDatabase();

    // Live desk status counts
    const liveStats = await db.get(`
      SELECT 
        COUNT(CASE WHEN status = 'free' THEN 1 END) as free,
        COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
        COUNT(CASE WHEN status = 'away' THEN 1 END) as away,
        COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned,
        COUNT(*) as total
      FROM desks
    `);

    // All-time session totals
    const sessionTotals = await db.get(`
      SELECT
        COUNT(*) as totalSessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedSessions,
        COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandonedSessions
      FROM sessions
    `);

    const abandonedCount = sessionTotals.abandonedSessions || 0;
    const totalSessions = sessionTotals.totalSessions || 0;
    const abandonmentRate = totalSessions > 0
      ? parseFloat(((abandonedCount / totalSessions) * 100).toFixed(1))
      : 0;
    const hoursSaved = parseFloat((abandonedCount * 1.5).toFixed(1));

    // Per-desk breakdown
    const perDesk = await db.all(`
      SELECT 
        d.id, d.name, d.zone, d.status,
        COUNT(s.id) as totalSessions,
        COUNT(CASE WHEN s.status = 'abandoned' THEN 1 END) as abandonedSessions,
        COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completedSessions
      FROM desks d
      LEFT JOIN sessions s ON s.desk_id = d.id
      GROUP BY d.id
      ORDER BY d.id
    `);

    // Zone breakdown
    const perZone = await db.all(`
      SELECT 
        d.zone,
        COUNT(DISTINCT d.id) as deskCount,
        COUNT(s.id) as totalSessions,
        COUNT(CASE WHEN s.status = 'abandoned' THEN 1 END) as abandonedSessions,
        COUNT(CASE WHEN d.status != 'free' THEN 1 END) as activeDesks
      FROM desks d
      LEFT JOIN sessions s ON s.desk_id = d.id
      GROUP BY d.zone
      ORDER BY d.zone
    `);

    // Most used desks
    const topDesks = await db.all(`
      SELECT d.name, d.zone, COUNT(s.id) as sessions
      FROM desks d
      LEFT JOIN sessions s ON s.desk_id = d.id
      GROUP BY d.id
      ORDER BY sessions DESC
      LIMIT 5
    `);

    // Recent 20 sessions
    const recentSessions = await db.all(`
      SELECT s.id, s.student_id, s.desk_id, d.name as desk_name, d.zone,
             s.started_at, s.expires_at, s.status, s.prompted
      FROM sessions s
      JOIN desks d ON s.desk_id = d.id
      ORDER BY s.started_at DESC
      LIMIT 20
    `);

    // Today's stats
    const today = new Date().toISOString().slice(0, 10);
    const todayStats = await db.get(`
      SELECT 
        COUNT(*) as sessionsToday,
        COUNT(DISTINCT student_id) as uniqueStudentsToday,
        COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandonedToday
      FROM sessions
      WHERE started_at LIKE ?
    `, `${today}%`);

    res.json({
      live: {
        free: liveStats.free || 0,
        occupied: liveStats.occupied || 0,
        away: liveStats.away || 0,
        abandoned: liveStats.abandoned || 0,
        total: liveStats.total || 0,
        occupancyRate: liveStats.total > 0
          ? parseFloat((((liveStats.occupied + liveStats.away + liveStats.abandoned) / liveStats.total) * 100).toFixed(1))
          : 0
      },
      allTime: {
        totalSessions,
        completedSessions: sessionTotals.completedSessions || 0,
        abandonedSessions: abandonedCount,
        abandonmentRate,
        hoursSaved
      },
      today: {
        sessionsToday: todayStats.sessionsToday || 0,
        uniqueStudentsToday: todayStats.uniqueStudentsToday || 0,
        abandonedToday: todayStats.abandonedToday || 0
      },
      perDesk,
      perZone,
      topDesks,
      recentSessions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, setBroadcaster };
