const { getDatabase } = require('./db');

let broadcastUpdate = () => {};

function setBroadcaster(fn) {
  broadcastUpdate = fn;
}

async function runSweep() {
  const db = await getDatabase();
  const now = new Date();

  try {
    const awaySessions = await db.all(`
      SELECT s.*, d.name as desk_name 
      FROM sessions s
      JOIN desks d ON s.desk_id = d.id
      WHERE s.status = 'active' AND d.status = 'away' AND s.away_expires_at IS NOT NULL
    `);

    for (const session of awaySessions) {
      const awayExpires = new Date(session.away_expires_at);
      if (now > awayExpires) {
        await db.run(
          "UPDATE sessions SET status = 'abandoned' WHERE id = ?",
          session.id
        );
        await db.run(
          "UPDATE desks SET status = 'abandoned' WHERE id = ?",
          session.desk_id
        );
      }
    }

    const activeSessions = await db.all(`
      SELECT s.*, d.name as desk_name 
      FROM sessions s
      JOIN desks d ON s.desk_id = d.id
      WHERE s.status = 'active' AND d.status = 'occupied'
    `);

    for (const session of activeSessions) {
      const expires = new Date(session.expires_at);
      if (now > expires) {
        if (session.prompted === 0) {
          const graceSeconds = 10 * 60;
          const graceExpires = new Date(now.getTime() + graceSeconds * 1000).toISOString();

          await db.run(
            "UPDATE sessions SET prompted = 1, prompted_at = ?, expires_at = ? WHERE id = ?",
            now.toISOString(),
            graceExpires,
            session.id
          );
        } else {
          await db.run(
            "UPDATE sessions SET status = 'abandoned' WHERE id = ?",
            session.id
          );
          await db.run(
            "UPDATE desks SET status = 'abandoned' WHERE id = ?",
            session.desk_id
          );
        }
      }
    }

    broadcastUpdate();

  } catch (err) {
    console.error(err);
  }
}

function startSweeper(intervalMs = 60000) {
  setInterval(runSweep, intervalMs);
}

module.exports = { startSweeper, setBroadcaster, runSweep };
