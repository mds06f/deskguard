# DeskGuard

DeskGuard is a full-stack, real-time library seat booking and anti-hoarding portal. It displays a live, color-coded floor map of seating availability, allows students to scan a desk's unique QR code to check in, supports temporary pauses (away mode), and runs automated server-side sweeps to release hoarded or abandoned desks when presence prompts are ignored.

---

## Environment Variables

The application can be configured using the following environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The port the Express backend server listens on. | `5001` |

---

## How to Run

Follow these steps to set up and run the application locally:

### 1. Install Dependencies
Run the installation command in the root folder to install root backend and frontend React dependencies:
```bash
npm install
```

### 2. Start the Application
Run the dev script to launch both the Express backend and the Vite frontend concurrently:
```bash
npm run dev
```

The application will be accessible at:
* Frontend Client: **`http://localhost:5173`**
* Backend API Server: **`http://localhost:5001`**
