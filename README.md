# 🛡️ DeskGuard

> **Library Seat Booking & Real-Time Anti-Hoarding System**

DeskGuard is a full-stack, real-time desk reservation portal designed to eliminate the common university problem of **seat hoarding** (students reserving library desks with bags/books and disappearing for hours). 

With a server-side timer worker, presence verification checks, and a librarian management panel, DeskGuard ensures maximum desk turnover and fair seating utilization.

---

## 🏆 The Hackathon PPT Pitch Outline

Use these 4 structured slides to showcase DeskGuard to the judges:

### 1. The Pain Point: "The Ghost Seat Epidemic"
* **The Hoarding Problem:** Students reserve study desks with backpacks, jackets, or notes, then leave for classes, lunch, or socializing for 2-6 hours.
* **The Cost:** Actual studying students spend up to 30 minutes walking around looking for a place to sit.
* **The Gap:** Traditional library apps show desk reservations but *cannot verify physical occupancy*, leading to ghost bookings.

### 2. The Solution: "DeskGuard's Anti-Hoarding Logic"
* **Interactive Live Map:** Color-coded SVG floor plan (Green = Free, Red = Occupied, Yellow = Away, Flashing = Abandoned).
* **QR Check-in:** Scan the desk's physical QR code, input Student ID, and secure the seat.
* **Step-Away Pause:** Need a coffee or bathroom break? Click **"Step Away"** to pause the seat for up to 20 minutes.
* **Presence Ping:** Every 2 hours, the server prompts: *"Still Here?"*. Failing to ping back within 10 minutes releases the seat.
* **Librarian Override:** Librarians get a dashboard showing "Abandoned" desks to sweep bags and free desks with a single click.

### 3. Technical Stack: "Robustness & Scalability"
* **Frontend:** React (Vite SPA) styled with a modern glassmorphism Vanilla CSS system.
* **Live Updates:** **WebSockets (ws)** for instant, real-time seat color changes across all students and librarians without manual refreshes.
* **Backend:** Node.js Express server.
* **Database & Timer State:** SQLite (for zero-config local runs, production-ready for PostgreSQL/Supabase) to store session logs.
* **Server-side Timers:** Robust background sweeper checks active timers every 5 seconds (configurable) to enforce expiration rules safely on the server side.

### 4. Future Scope: "What We'd Build Next"
* **Computer Vision Integration:** Feed library security cameras to a YOLO model to auto-detect if bags are left on a seat with no human present.
* **Mobile Push Alerts:** Send SMS/WhatsApp/Push notifications when a seat is approaching its presence check or away expiration.
* **Heatmap Analytics:** Detailed library floor charts showing peak hours, popular wings, and student seat utilization rates over time.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory if you wish to override these defaults:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The port the Express backend server listens on. | `5001` |
| `DEMO_MODE` | Speeds up timer sweeps (`true`) for demo testing. | `true` |

> **Note on Demo Mode vs Production Mode:**
> * **Demo Mode (`true`):** Check-in sessions expire in **2 minutes**. Step-Away is **20 seconds**. Presence ping grace is **15 seconds**. Ideal for live evaluation.
> * **Production Mode (`false`):** Check-in sessions expire in **2 hours**. Step-Away is **20 minutes**. Presence ping grace is **10 minutes**.

---

## 🚀 How to Run Locally

Get the application up and running on your local machine in two steps:

### 1. Install Dependencies
Run the install command in the root folder (it will automatically install both root backend and frontend React dependencies):
```bash
npm install
```

### 2. Start the Application
Run the unified development command:
```bash
npm run dev
```

This starts:
1. The Express backend on **`http://localhost:5001`**
2. The Vite dev server on **`http://localhost:5173`**

Open **[http://localhost:5173](http://localhost:5173)** in your browser to explore the live portal!

---

## 🏗️ Technical Architecture Details

### Server-Side Timer Sweeper (`backend/worker.js`)
Rather than relying on client-side state (which is easily bypassed or lost when a tab is closed), all timer state is managed in the SQLite database and evaluated server-side.
```javascript
// A database sweep worker runs periodically (every 5 seconds):
// 1. If desk is 'away' and away_expires_at is past -> mark desk 'abandoned'.
// 2. If desk is 'occupied', expires_at is past, and prompted is 0 -> set prompted = 1 and add grace time.
// 3. If desk is 'occupied', prompted is 1, and grace expires_at is past -> mark desk 'abandoned'.
```

### Real-Time WebSocket Synchronization (`backend/server.js`)
When any student checks in, steps away, or a librarian resets an abandoned seat, a WebSocket message `DESK_UPDATE` broadcasts the full floor data to all connected clients instantly.
