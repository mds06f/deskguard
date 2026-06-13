# DeskGuard

## Introduction

DeskGuard is a full-stack, real-time library seat booking and anti-hoarding system. It gives students a live, color-coded floor map of available seats, QR-code check-in at each desk, and an automated server-side sweeper that detects and reclaims abandoned desks. Librarians get a dedicated console and an analytics dashboard with live occupancy, session history, zone breakdowns, and abandonment metrics.

**Key Features**
- Real-time floor map with WebSocket updates (free / occupied / away / abandoned)
- QR-code based check-in flow for students
- 20-minute away timer with automatic expiry
- 2-hour session limit with presence verification prompt
- Automated background sweeper that frees abandoned seats
- Librarian console for manual seat resets
- Analytics dashboard: live stats, today's activity, zone utilisation, per-desk breakdown, session log

---

## Project Structure

```
deskguard/
├── backend/
│   ├── server.js       # Express + WebSocket server entry point
│   ├── routes.js       # All REST API route handlers
│   ├── db.js           # SQLite database setup and schema
│   └── worker.js       # Background sweeper for expired sessions
├── frontend/
│   ├── src/
│   │   ├── App.jsx     # Main application with routing and floor map
│   │   ├── Analytics.jsx # Librarian analytics dashboard
│   │   ├── index.css   # Global design system (light theme)
│   │   └── main.jsx    # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json    # Frontend dependencies (React, Vite)
├── mockups/            # Design mockups for all screens
├── .env                # Local environment variables (never committed)
├── .env.example        # Template showing required env variables
├── package.json        # Root monorepo scripts and backend dependencies
└── README.md
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in any values you need to override:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the Express backend listens on | `5001` |
| `DATABASE_URL` | Path to the SQLite `.db` file | `./deskguard.db` |

> The frontend (Vite) always runs on port `5173` in development.

---

## How to Run

### Prerequisites
- Node.js v18 or higher
- npm v9 or higher

### 1. Clone the repository

```bash
git clone https://github.com/mds06f/deskguard.git
cd deskguard
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env if you need to change PORT or DATABASE_URL
```

### 3. Install all dependencies (backend + frontend)

```bash
npm install
```

> `postinstall` automatically runs `npm install` inside the `frontend/` directory as well.

### 4. Start the development server

```bash
npm run dev
```

This starts both services concurrently:

| Service | URL |
|---|---|
| Frontend (Vite + React) | http://localhost:5173 |
| Backend (Express + WebSocket) | http://localhost:5001 |

### 5. Available pages

| Path | Description |
|---|---|
| `/` | Student floor map — live seat availability |
| `/desk/:id` | Student check-in page for a specific desk (QR scan target) |
| `/admin` | Librarian console — active violations and seat resets |
| `/analytics` | Librarian analytics dashboard |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/desks` | Get all desks with current status and active session |
| `POST` | `/api/desks/:id/checkin` | Check in a student to a desk |
| `POST` | `/api/desks/:id/away` | Mark a desk as away (starts 20-min timer) |
| `POST` | `/api/desks/:id/back` | Mark student as returned from away |
| `POST` | `/api/desks/:id/ping` | Confirm presence (resets 2-hr session timer) |
| `POST` | `/api/desks/:id/checkout` | Check out and free the desk |
| `POST` | `/api/desks/:id/reset` | Librarian reset — marks session abandoned, frees desk |
| `GET` | `/api/analytics` | Basic live stats summary |
| `GET` | `/api/analytics/full` | Full analytics payload for the dashboard |

---

## Production Build

To build the frontend for production and serve it via the Express backend:

```bash
cd frontend && npm run build
cd ..
npm start
```

The built frontend is served as static files from `frontend/dist/` by the Express server. The entire app runs on a single port (`PORT`).
