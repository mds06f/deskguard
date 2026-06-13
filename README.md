# DeskGuard

## Introduction
DeskGuard is a production‑grade, full‑stack application for real‑time library seat booking and anti‑hoarding. It provides a live, color‑coded floor map, QR‑code check‑in for students, temporary away mode, and automated server‑side sweeps that free up abandoned desks.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT`   | Port for the Express backend server. | `5001` |
| `NODE_ENV` | Node environment (`development` or `production`). | `development` |
| `DB_PATH` | Path to SQLite database file. | `./data.db` |

## How to Run

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Start the application** (both backend and frontend concurrently)
   ```bash
   npm run dev
   ```
The app will be available at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001`

---

*For detailed setup instructions, refer to the project documentation.*
