require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { getDatabase } = require('./db');
const { router, setBroadcaster: setRouteBroadcaster } = require('./routes');
const { startSweeper, setBroadcaster: setWorkerBroadcaster, runSweep } = require('./worker');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.use('/api', router);

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

async function broadcastDeskUpdates() {
  try {
    const db = await getDatabase();
    const desks = await db.all('SELECT * FROM desks');
    const activeSessions = await db.all("SELECT * FROM sessions WHERE status = 'active'");
    
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
    stats.hoursSaved = parseFloat((rawCount * 1.5).toFixed(1));

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

    broadcast({ type: 'DESK_UPDATE', desks: data, stats });
  } catch (err) {
    console.error(err);
  }
}

setRouteBroadcaster(broadcastDeskUpdates);
setWorkerBroadcaster(broadcastDeskUpdates);

wss.on('connection', ws => {
  broadcastDeskUpdates();

  ws.on('message', message => {
  });

  ws.on('close', () => {
  });
});

async function startApp() {
  try {
    await getDatabase();
    await runSweep();
    startSweeper(60000);

    server.listen(PORT, () => {
      console.log(`[SERVER] DeskGuard server running on port ${PORT}`);
    });
  } catch (err) {
    process.exit(1);
  }
}

startApp();
