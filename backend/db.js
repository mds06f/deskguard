const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let db = null;

async function getDatabase() {
  if (db) return db;

  const dbPath = process.env.DATABASE_URL
    ? process.env.DATABASE_URL
    : path.join(__dirname, '../deskguard.db');

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.run('PRAGMA foreign_keys = ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS desks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      zone TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('free', 'occupied', 'away', 'abandoned')) DEFAULT 'free'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      desk_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      away_expires_at TEXT,
      remaining_seconds INTEGER,
      prompted INTEGER DEFAULT 0,
      prompted_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'abandoned')) DEFAULT 'active',
      FOREIGN KEY(desk_id) REFERENCES desks(id) ON DELETE CASCADE
    );
  `);

  const desksCount = await db.get('SELECT COUNT(*) as count FROM desks');
  if (desksCount.count === 0) {
    const defaultDesks = [
      { id: 'A1', name: 'Desk A1', zone: 'Reading Area A' },
      { id: 'A2', name: 'Desk A2', zone: 'Reading Area A' },
      { id: 'A3', name: 'Desk A3', zone: 'Reading Area A' },
      { id: 'A4', name: 'Desk A4', zone: 'Reading Area A' },
      { id: 'B1', name: 'Desk B1', zone: 'Reading Area B' },
      { id: 'B2', name: 'Desk B2', zone: 'Reading Area B' },
      { id: 'B3', name: 'Desk B3', zone: 'Reading Area B' },
      { id: 'B4', name: 'Desk B4', zone: 'Reading Area B' },
      { id: 'C1', name: 'Desk C1', zone: 'Reading Area C' },
      { id: 'C2', name: 'Desk C2', zone: 'Reading Area C' },
      { id: 'C3', name: 'Desk C3', zone: 'Reading Area C' },
      { id: 'C4', name: 'Desk C4', zone: 'Reading Area C' }
    ];

    const stmt = await db.prepare('INSERT INTO desks (id, name, zone, status) VALUES (?, ?, ?, ?)');
    for (const d of defaultDesks) {
      await stmt.run(d.id, d.name, d.zone, 'free');
    }
    await stmt.finalize();
  }

  return db;
}

module.exports = { getDatabase };
