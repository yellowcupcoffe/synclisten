const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// ─── Config ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const ACCESS_CODE = process.env.ACCESS_CODE || ""; // Set this in production!
const MAX_ROOMS = 5; // Prevent abuse on free tier
const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ─── Room Code Generation ──────────────────────────────────────
const WORDS = [
  "ROSE", "LUNA", "STAR", "MOON", "LOVE", "DREAM", "GLOW", "DUSK",
  "DAWN", "BLISS", "FAWN", "SAGE", "IRIS", "EMBER", "PEARL", "CORAL",
  "HAVEN", "BLOOM", "MAPLE", "CLOUD", "OCEAN", "BREEZE", "WILLOW",
  "HONEY", "FLAME", "SPARK", "VELVET", "AURORA", "FROST", "VIOLET",
  "INDIE", "LYRIC", "MUSE", "PETAL", "SILK", "ECHO", "NOVA", "OPAL",
  "RAIN", "SOLAR", "HAZE", "DUNE", "CEDAR", "LARK", "FERN", "WREN",
];

function generateRoomCode() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = String(Math.floor(1000 + Math.random() * 9000));
  return `${word}-${num}`;
}

// ─── In-Memory State ───────────────────────────────────────────
// Map<roomCode, RoomState>
const rooms = new Map();

/**
 * @typedef {Object} QueueItem
 * @property {string} id          - unique id (timestamp-based)
 * @property {string} videoId     - YouTube video ID
 * @property {string} title       - song title
 * @property {string} thumbnail   - thumbnail URL
 * @property {string} channelName - YouTube channel name
 * @property {string} addedBy     - display name of the user who added it
 * @property {number} duration    - duration in seconds (0 if unknown)
 */

/**
 * @typedef {Object} RoomState
 * @property {string}      code
 * @property {Object[]}    users         - [{ socketId, name }]
 * @property {QueueItem[]} queue
 * @property {number}      currentIndex  - index in queue of the currently playing song (-1 if none)
 * @property {boolean}     isPlaying
 * @property {number}      currentTime   - playback position in seconds
 * @property {number}      lastSyncAt    - Date.now() of the last time currentTime was updated
 */

function createRoom(code) {
  return {
    code,
    users: [],
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    lastSyncAt: Date.now(),
  };
}

// ─── Helper: compute estimated current time ────────────────────
function getEstimatedTime(room) {
  if (!room.isPlaying) return room.currentTime;
  const elapsed = (Date.now() - room.lastSyncAt) / 1000;
  return room.currentTime + elapsed;
}

// ─── Helper: broadcast full room state ─────────────────────────
function broadcastRoomState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const state = {
    code: room.code,
    users: room.users.map((u) => ({ name: u.name, id: u.socketId })),
    queue: room.queue,
    currentIndex: room.currentIndex,
    isPlaying: room.isPlaying,
    currentTime: getEstimatedTime(room),
    currentSong: room.currentIndex >= 0 ? room.queue[room.currentIndex] : null,
  };

  io.to(roomCode).emit("room-state", state);
}

// ─── Helper: find room by socket ───────────────────────────────
function findRoomBySocket(socketId) {
  for (const [code, room] of rooms) {
    if (room.users.some((u) => u.socketId === socketId)) {
      return room;
    }
  }
  return null;
}

// ─── YouTube oEmbed proxy ──────────────────────────────────────
app.get("/api/oembed", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) throw new Error("YouTube oEmbed failed");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch video info" });
  }
});

// ─── Health check ──────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", rooms: rooms.size });
});

// ─── Socket.io Events ─────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`✦ Connected: ${socket.id}`);

  // ── Create room ───────────────────────────────────────────
  socket.on("create-room", ({ name, accessCode }, callback) => {
    // Validate access code
    if (ACCESS_CODE && accessCode !== ACCESS_CODE) {
      return callback?.({ success: false, error: "Invalid access code" });
    }
    // Rate limit rooms
    if (rooms.size >= MAX_ROOMS) {
      return callback?.({ success: false, error: "Server is full. Try again later." });
    }

    let code;
    // Ensure unique code
    do {
      code = generateRoomCode();
    } while (rooms.has(code));

    const room = createRoom(code);
    room.users.push({ socketId: socket.id, name: name || "Guest" });
    rooms.set(code, room);

    socket.join(code);
    console.log(`✦ Room ${code} created by "${name}" (${socket.id})`);

    if (typeof callback === "function") {
      callback({ success: true, code });
    }

    broadcastRoomState(code);
  });

  // ── Join room ─────────────────────────────────────────────
  socket.on("join-room", ({ code, name, accessCode }, callback) => {
    // Validate access code
    if (ACCESS_CODE && accessCode !== ACCESS_CODE) {
      return callback?.({ success: false, error: "Invalid access code" });
    }
    const roomCode = code?.toUpperCase?.();
    const room = rooms.get(roomCode);

    if (!room) {
      return callback?.({ success: false, error: "Room not found" });
    }
    if (room.users.length >= 2) {
      return callback?.({ success: false, error: "Room is full" });
    }
    // Prevent duplicate join
    if (room.users.some((u) => u.socketId === socket.id)) {
      return callback?.({ success: false, error: "Already in room" });
    }

    room.users.push({ socketId: socket.id, name: name || "Guest" });
    socket.join(roomCode);
    console.log(`✦ "${name}" joined room ${roomCode} (${socket.id})`);

    if (typeof callback === "function") {
      callback({ success: true, code: roomCode });
    }

    io.to(roomCode).emit("user-joined", { name: name || "Guest", id: socket.id });
    broadcastRoomState(roomCode);
  });

  // ── Add song to queue ─────────────────────────────────────
  socket.on("add-song", ({ videoId, title, thumbnail, channelName, duration }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const user = room.users.find((u) => u.socketId === socket.id);
    const song = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      videoId,
      title: title || "Unknown Title",
      thumbnail: thumbnail || "",
      channelName: channelName || "",
      addedBy: user?.name || "Guest",
      duration: duration || 0,
    };

    room.queue.push(song);
    console.log(`✦ Song added to ${room.code}: "${song.title}" by ${song.addedBy}`);

    // Auto-start playing if this is the first song and nothing is playing
    if (room.queue.length === 1 && room.currentIndex === -1) {
      room.currentIndex = 0;
      room.isPlaying = true;
      room.currentTime = 0;
      room.lastSyncAt = Date.now();
    }

    broadcastRoomState(room.code);
  });

  // ── Remove song from queue ────────────────────────────────
  socket.on("remove-song", ({ songId }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const idx = room.queue.findIndex((s) => s.id === songId);
    if (idx === -1) return;

    // If removing the currently playing song, stop and advance
    if (idx === room.currentIndex) {
      room.queue.splice(idx, 1);
      if (room.queue.length === 0) {
        room.currentIndex = -1;
        room.isPlaying = false;
        room.currentTime = 0;
      } else {
        room.currentIndex = Math.min(idx, room.queue.length - 1);
        room.currentTime = 0;
        room.lastSyncAt = Date.now();
      }
    } else {
      room.queue.splice(idx, 1);
      // Adjust currentIndex if needed
      if (idx < room.currentIndex) {
        room.currentIndex--;
      }
    }

    broadcastRoomState(room.code);
  });

  // ── Reorder queue ─────────────────────────────────────────
  socket.on("reorder-queue", ({ fromIndex, toIndex }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    if (fromIndex < 0 || fromIndex >= room.queue.length) return;
    if (toIndex < 0 || toIndex >= room.queue.length) return;

    const [moved] = room.queue.splice(fromIndex, 1);
    room.queue.splice(toIndex, 0, moved);

    // Adjust currentIndex to track the same song
    if (room.currentIndex === fromIndex) {
      room.currentIndex = toIndex;
    } else if (fromIndex < room.currentIndex && toIndex >= room.currentIndex) {
      room.currentIndex--;
    } else if (fromIndex > room.currentIndex && toIndex <= room.currentIndex) {
      room.currentIndex++;
    }

    broadcastRoomState(room.code);
  });

  // ── Play ──────────────────────────────────────────────────
  socket.on("play", ({ time }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    room.isPlaying = true;
    if (typeof time === "number") {
      room.currentTime = time;
    }
    room.lastSyncAt = Date.now();

    broadcastRoomState(room.code);
  });

  // ── Pause ─────────────────────────────────────────────────
  socket.on("pause", ({ time }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    room.isPlaying = false;
    if (typeof time === "number") {
      room.currentTime = time;
    }
    room.lastSyncAt = Date.now();

    broadcastRoomState(room.code);
  });

  // ── Seek ──────────────────────────────────────────────────
  socket.on("seek", ({ time }) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    room.currentTime = time;
    room.lastSyncAt = Date.now();

    broadcastRoomState(room.code);
  });

  // ── Skip (next) ───────────────────────────────────────────
  socket.on("skip", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    if (room.currentIndex < room.queue.length - 1) {
      room.currentIndex++;
      room.currentTime = 0;
      room.isPlaying = true;
      room.lastSyncAt = Date.now();
    } else {
      // End of queue
      room.isPlaying = false;
      room.currentTime = 0;
    }

    broadcastRoomState(room.code);
  });

  // ── Previous ──────────────────────────────────────────────
  socket.on("previous", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    if (room.currentIndex > 0) {
      room.currentIndex--;
      room.currentTime = 0;
      room.isPlaying = true;
      room.lastSyncAt = Date.now();
    } else {
      // Restart current song
      room.currentTime = 0;
      room.lastSyncAt = Date.now();
    }

    broadcastRoomState(room.code);
  });

  // ── Song ended (auto-advance) ─────────────────────────────
  socket.on("song-ended", () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    if (room.currentIndex < room.queue.length - 1) {
      room.currentIndex++;
      room.currentTime = 0;
      room.isPlaying = true;
      room.lastSyncAt = Date.now();
    } else {
      // Queue finished
      room.isPlaying = false;
      room.currentTime = 0;
    }

    broadcastRoomState(room.code);
  });

  // ── Sync heartbeat (client reports its time periodically) ─
  socket.on("sync-heartbeat", ({ time }) => {
    // Clients can send their current time for drift detection
    // Server doesn't act on this in MVP but could be used for
    // more sophisticated sync in the future
  });

  // ── Disconnect ────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`✦ Disconnected: ${socket.id}`);

    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const user = room.users.find((u) => u.socketId === socket.id);
    room.users = room.users.filter((u) => u.socketId !== socket.id);

    io.to(room.code).emit("user-left", {
      name: user?.name || "Guest",
      id: socket.id,
    });

    // If room is empty, clean up after a delay (give time to reconnect)
    if (room.users.length === 0) {
      setTimeout(() => {
        const r = rooms.get(room.code);
        if (r && r.users.length === 0) {
          rooms.delete(room.code);
          console.log(`✦ Room ${room.code} cleaned up (empty)`);
        }
      }, 60000); // 1 minute grace period
    } else {
      // Pause playback when partner leaves
      if (room.isPlaying) {
        room.isPlaying = false;
        room.currentTime = getEstimatedTime(room);
        room.lastSyncAt = Date.now();
      }
      broadcastRoomState(room.code);
    }
  });
});

// ─── Start Server ──────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n  ✦ SyncListen server running on http://localhost:${PORT}`);
  console.log(`  ✦ Access code: ${ACCESS_CODE ? "ENABLED" : "DISABLED (open access)"}\n`);
});
