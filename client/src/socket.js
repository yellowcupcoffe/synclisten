import { io } from "socket.io-client";

// In production, set VITE_SERVER_URL to your Render backend URL
const SERVER_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log("✦ Connected to SyncListen server:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("✦ Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.warn("✦ Connection error:", err.message);
});

export default socket;
