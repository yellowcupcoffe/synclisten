import { useState } from "react";
import socket from "../socket";

export default function LobbyScreen({ onJoined }) {
  const [name, setName] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  const [accessCode, setAccessCode] = useState(import.meta.env.VITE_ACCESS_CODE || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const needsAccessCode = !import.meta.env.VITE_ACCESS_CODE; // show input only if not baked in

  const handleCreate = () => {
    if (!name.trim()) {
      setError("Enter your name first ✦");
      return;
    }
    setLoading(true);
    setError("");
    socket.emit("create-room", { name: name.trim(), accessCode }, (res) => {
      setLoading(false);
      if (res?.success) {
        onJoined(name.trim(), res.code);
      } else {
        setError(res?.error || "Failed to create session.");
      }
    });
  };

  const handleJoin = () => {
    if (!name.trim()) {
      setError("Enter your name first ✦");
      return;
    }
    if (!roomInput.trim()) {
      setError("Enter a room code ✦");
      return;
    }
    setLoading(true);
    setError("");
    socket.emit(
      "join-room",
      { code: roomInput.trim().toUpperCase(), name: name.trim(), accessCode },
      (res) => {
        setLoading(false);
        if (res?.success) {
          onJoined(name.trim(), res.code);
        } else {
          setError(res?.error || "Could not join. Check the code.");
        }
      }
    );
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen overflow-hidden flex items-center justify-center relative">
      {/* Celestial Background */}
      <div className="fixed inset-0 bg-radial-celestial z-0" />
      <div className="orb w-96 h-96 bg-primary top-[-10%] left-[-10%]" />
      <div className="orb w-80 h-80 bg-secondary bottom-[5%] right-[-5%]" />

      {/* Floating particles */}
      <div className="fixed inset-0 opacity-20 pointer-events-none z-0">
        <svg width="100%" height="100%">
          <circle cx="10%" cy="20%" r="1" fill="#fff" />
          <circle cx="35%" cy="45%" r="1.5" fill="#E91E8C" />
          <circle cx="70%" cy="15%" r="1" fill="#fff" />
          <circle cx="85%" cy="80%" r="2" fill="#B24BFF" />
          <circle cx="45%" cy="90%" r="1" fill="#fff" />
          <circle cx="15%" cy="70%" r="1.2" fill="#E91E8C" />
        </svg>
      </div>

      {/* Main Content */}
      <main className="relative z-10 w-full px-6 flex flex-col items-center">
        <div className="w-full max-w-[420px] bg-surface-variant/40 backdrop-blur-2xl p-10 rounded-lg flex flex-col items-center text-center border-t border-white/10 shadow-2xl">
          {/* Branding */}
          <header className="mb-10">
            <h1 className="text-[28px] font-headline font-extrabold tracking-tighter gradient-text">
              SyncListen
            </h1>
            <p className="text-on-surface-variant italic text-sm mt-1 font-medium tracking-wide">
              Listen together, miles apart
            </p>
          </header>

          <div className="w-full space-y-6">
            {/* Name Input */}
            <div className="text-left w-full">
              <label
                htmlFor="username"
                className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 px-1"
              >
                Your Alias
              </label>
              <input
                id="username"
                type="text"
                className="w-full bg-[#161B26] border-none rounded-md px-5 py-4 text-on-surface placeholder:text-slate-600 focus:ring-2 focus:ring-primary-container transition-all duration-300 outline-none"
                placeholder="E.g. Stardust Traveler"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>

            {/* Access Code (only shown if not baked into env) */}
            {needsAccessCode && (
              <div className="text-left w-full">
                <label
                  htmlFor="access-code"
                  className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 px-1"
                >
                  Access Code
                </label>
                <input
                  id="access-code"
                  type="password"
                  className="w-full bg-[#161B26] border-none rounded-md px-5 py-4 text-on-surface placeholder:text-slate-600 focus:ring-2 focus:ring-secondary transition-all duration-300 outline-none"
                  placeholder="Enter access code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                />
              </div>
            )}

            {/* Error display */}
            {error && (
              <p className="text-sm text-error font-medium animate-pulse">
                {error}
              </p>
            )}

            {/* Create Session */}
            <button
              id="btn-create"
              onClick={handleCreate}
              disabled={loading}
              className="w-full gradient-button celestial-glow text-white font-headline font-bold py-4 px-6 rounded-md flex items-center justify-center gap-3 active:scale-[0.98] transition-transform duration-150 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">
                auto_awesome
              </span>
              {loading ? "Creating…" : "Create a Session"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 py-2">
              <div className="h-[1px] flex-1 bg-outline-variant/30" />
              <span className="text-[12px] font-bold text-outline uppercase tracking-tighter">
                or
              </span>
              <div className="h-[1px] flex-1 bg-outline-variant/30" />
            </div>

            {/* Join Session */}
            {!showJoin ? (
              <button
                id="btn-join-toggle"
                onClick={() => setShowJoin(true)}
                className="w-full bg-transparent border border-outline-variant/50 hover:bg-white/5 text-on-surface font-headline font-semibold py-4 px-6 rounded-md flex items-center justify-center gap-3 transition-colors duration-300"
              >
                <span className="material-symbols-outlined text-[20px]">
                  link
                </span>
                Join a Session
              </button>
            ) : (
              <div className="space-y-3 animate-[slide-in_0.3s_ease-out]">
                <div className="relative">
                  <input
                    id="room-code-input"
                    type="text"
                    className="w-full bg-[#161B26] border-none rounded-md px-5 py-4 pr-24 text-on-surface placeholder:text-slate-600 focus:ring-2 focus:ring-secondary transition-all duration-300 outline-none uppercase tracking-widest font-mono font-bold"
                    placeholder="ROSE-4821"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    autoFocus
                  />
                  <button
                    id="btn-connect"
                    onClick={handleJoin}
                    disabled={loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 gradient-button text-white text-xs font-bold px-4 py-2 rounded-md disabled:opacity-50"
                  >
                    {loading ? "…" : "Connect"}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowJoin(false);
                    setRoomInput("");
                    setError("");
                  }}
                  className="text-xs text-outline hover:text-on-surface transition-colors"
                >
                  ← Back
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="mt-12">
            <p className="text-[12px] text-slate-500 font-medium">
              No accounts needed. Just a code and your person{" "}
              <span className="text-secondary text-[14px]">💜</span>
            </p>
          </footer>
        </div>

        {/* Feature badges */}
        <div className="mt-12 flex items-center gap-8 opacity-40">
          {[
            { icon: "speed", label: "Ultra-Low Latency", color: "text-primary" },
            { icon: "high_quality", label: "Hi-Fi Stream", color: "text-secondary" },
            { icon: "all_inclusive", label: "Multi-Platform", color: "text-tertiary" },
          ].map((f) => (
            <div key={f.icon} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center">
                <span className={`material-symbols-outlined ${f.color} text-[20px]`}>
                  {f.icon}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {f.label}
              </span>
            </div>
          ))}
        </div>
      </main>

      {/* Side decoration */}
      <div className="fixed right-10 top-1/2 -translate-y-1/2 hidden xl:block pointer-events-none">
        <div className="rotate-90 origin-right">
          <span className="text-[100px] font-black font-headline text-white/[0.03] select-none tracking-tighter">
            RESONANCE
          </span>
        </div>
      </div>
    </div>
  );
}
