# 🎵 SyncListen

Real-time synchronized music listening for two people. Listen to YouTube songs together in perfect sync — audio only, with a romantic dark theme.

## Features

- 🔗 **Room codes** — One creates a session (e.g. `ROSE-4821`), partner joins with the code
- 🎶 **Shared queue** — Both can add YouTube songs, see who added what
- ▶️ **Synced playback** — Play, pause, seek, skip — mirrored in real-time via WebSockets
- 🎨 **Animated visualizer** — Frequency bars + spinning album art
- 🔒 **Access protection** — Optional secret code prevents unauthorized use
- 📱 **Mobile-friendly** — Responsive with bottom tab navigation

## Quick Start

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Start the server
cd server && npm run dev      # → http://localhost:3001

# 3. Start the client
cd client && npm run dev      # → http://localhost:5173
```

## Environment Variables

### Server (`server/`)
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `ACCESS_CODE` | Secret code to restrict access (leave empty for open access) | `""` |

### Client (`client/`)
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SERVER_URL` | Backend server URL | `http://localhost:3001` |
| `VITE_ACCESS_CODE` | Pre-fill access code (hides the input field) | `""` |

## Deployment

### Render (Backend)
1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect this repo, set root directory to `server`
3. Build command: `npm install`
4. Start command: `node index.js`
5. Add env var: `ACCESS_CODE` = your secret code

### Vercel (Frontend)
1. Import this repo on [vercel.com](https://vercel.com)
2. Set root directory to `client`
3. Add env vars:
   - `VITE_SERVER_URL` = your Render backend URL (e.g. `https://synclisten-server.onrender.com`)
   - `VITE_ACCESS_CODE` = same secret code as server

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **YouTube**: iFrame API (video hidden, audio only)
- **No database** — session state lives in server memory
