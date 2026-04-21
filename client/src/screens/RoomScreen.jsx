import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import socket from "../socket";
import Player from "../components/Player";
import {
  extractVideoId,
  fetchVideoInfo,
  getThumbnail,
  formatTime,
} from "../utils/youtube";

export default function RoomScreen({ userName, roomCode, onLeave }) {
  /* ─── State ──────────────────────────────────── */
  const [roomState, setRoomState] = useState(null);
  const [activeTab, setActiveTab] = useState("playing"); // 'playing' | 'queue'
  const [songUrl, setSongUrl] = useState("");
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [playerTime, setPlayerTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [copied, setCopied] = useState(false);

  const playerRef = useRef(null);
  const lastVideoIdRef = useRef(null);
  const syncLockRef = useRef(false); // prevent sync loops

  /* ─── Derived ────────────────────────────────── */
  const currentSong = roomState?.currentSong || null;
  const queue = roomState?.queue || [];
  const users = roomState?.users || [];
  const isPlaying = roomState?.isPlaying || false;
  const myUser = users.find((u) => u.id === socket.id);
  const partnerUser = users.find((u) => u.id !== socket.id);

  /* ─── Socket Events ──────────────────────────── */
  useEffect(() => {
    const handleRoomState = (state) => {
      setRoomState(state);
    };

    socket.on("room-state", handleRoomState);
    return () => {
      socket.off("room-state", handleRoomState);
    };
  }, []);

  /* ─── Sync player with server state ──────────── */
  useEffect(() => {
    if (!roomState || !playerRef.current || syncLockRef.current) return;

    const player = playerRef.current;
    const serverVideoId = currentSong?.videoId;
    const serverTime = roomState.currentTime || 0;
    const serverPlaying = roomState.isPlaying;

    // Video changed → load new video
    if (serverVideoId && serverVideoId !== lastVideoIdRef.current) {
      lastVideoIdRef.current = serverVideoId;
      syncLockRef.current = true;
      player.loadVideo(serverVideoId, serverTime);
      // Give the player time to load, then play/pause
      setTimeout(() => {
        if (serverPlaying) {
          player.play();
        } else {
          player.pause();
        }
        syncLockRef.current = false;
      }, 1000);
      return;
    }

    // No video
    if (!serverVideoId) {
      lastVideoIdRef.current = null;
      return;
    }

    // Same video: sync play state
    const localState = player.getState();
    const isLocallyPlaying = localState === 1; // 1 = PLAYING

    if (serverPlaying && !isLocallyPlaying) {
      player.play();
    } else if (!serverPlaying && isLocallyPlaying) {
      player.pause();
    }

    // Sync time (only if drift > 2s)
    const localTime = player.getCurrentTime();
    if (Math.abs(localTime - serverTime) > 2) {
      player.seekTo(serverTime);
    }
  }, [roomState]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Player time update callback ────────────── */
  const handleTimeUpdate = useCallback((time, duration) => {
    setPlayerTime(time);
    if (duration) setPlayerDuration(duration);
  }, []);

  /* ─── Player events ──────────────────────────── */
  const handleSongEnded = useCallback(() => {
    socket.emit("song-ended");
  }, []);

  /* ─── Controls ───────────────────────────────── */
  const handlePlayPause = () => {
    if (!currentSong) return;
    const time = playerRef.current?.getCurrentTime() || 0;
    if (isPlaying) {
      socket.emit("pause", { time });
    } else {
      socket.emit("play", { time });
    }
  };

  const handleSkip = () => socket.emit("skip");
  const handlePrevious = () => socket.emit("previous");

  const handleSeek = (e) => {
    if (!playerDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * playerDuration;
    socket.emit("seek", { time });
  };

  /* ─── Add song ───────────────────────────────── */
  const handleAddSong = async () => {
    const url = songUrl.trim();
    if (!url) return;

    const videoId = extractVideoId(url);
    if (!videoId) {
      alert("Invalid YouTube URL");
      return;
    }

    setIsAddingSong(true);
    const info = await fetchVideoInfo(url);
    socket.emit("add-song", {
      videoId,
      title: info?.title || "Unknown Title",
      thumbnail: info?.thumbnail || getThumbnail(videoId),
      channelName: info?.channelName || "",
      duration: 0,
    });
    setSongUrl("");
    setIsAddingSong(false);
  };

  /* ─── Remove song ────────────────────────────── */
  const handleRemoveSong = (songId) => {
    socket.emit("remove-song", { songId });
  };

  /* ─── Copy room code ─────────────────────────── */
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: ignore */
    }
  };

  /* ─── Visualizer bars memo ───────────────────── */
  const vizBars = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => (
        <div
          key={i}
          className={`viz-bar ${!isPlaying ? "paused" : ""}`}
          style={{ animationDelay: `${i * 0.05}s` }}
        />
      )),
    [isPlaying]
  );

  /* ─── Seek bar percentage ────────────────────── */
  const seekPct =
    playerDuration > 0 ? (playerTime / playerDuration) * 100 : 0;

  /* ─── Render ─────────────────────────────────── */
  return (
    <div className="antialiased overflow-x-hidden min-h-screen bg-[#06080F] text-[#F0F0F5] font-body">
      {/* Hidden YouTube Player */}
      <Player
        ref={playerRef}
        onEnded={handleSongEnded}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* ── TOP BAR ─────────────────────────────── */}
      <nav className="flex justify-between items-center w-full px-6 py-4 fixed top-0 z-50 bg-slate-950/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-slate-100 italic font-headline tracking-tight">
            SyncListen
          </span>
          <button
            onClick={handleCopyCode}
            className="bg-surface-container-highest px-3 py-1 rounded-full text-[10px] font-bold tracking-widest text-primary uppercase hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Click to copy"
          >
            {copied ? "Copied!" : `#${roomCode}`}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Presence avatars */}
          <div className="flex -space-x-3 overflow-hidden">
            {users.map((u, idx) => (
              <div
                key={u.id}
                className="relative inline-block h-8 w-8 rounded-full ring-2 ring-surface"
              >
                <div
                  className={`h-full w-full rounded-full flex items-center justify-center text-[11px] font-bold ${
                    idx === 0
                      ? "bg-gradient-to-br from-primary-container to-primary text-white"
                      : "bg-gradient-to-br from-secondary-container to-secondary text-white"
                  }`}
                >
                  {u.name?.[0]?.toUpperCase() || "?"}
                </div>
                <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-tertiary ring-1 ring-surface" />
              </div>
            ))}
            {/* Empty slot if only 1 user */}
            {users.length < 2 && (
              <div className="relative inline-block h-8 w-8 rounded-full ring-2 ring-surface">
                <div className="h-full w-full rounded-full flex items-center justify-center text-[11px] font-bold bg-surface-container-highest text-outline">
                  ?
                </div>
              </div>
            )}
          </div>

          {/* Names */}
          <span className="text-[10px] text-on-surface-variant font-semibold hidden sm:block">
            {users.map((u) => u.name).join(" & ") ||
              userName}
          </span>

          {/* Sync indicator */}
          <div className="flex items-center gap-1.5 bg-surface-container-high px-2.5 py-1 rounded-full">
            <div
              className={`w-1.5 h-1.5 rounded-full sync-dot ${
                users.length >= 2 ? "bg-tertiary" : "bg-outline"
              }`}
            />
            <span className="text-[10px] font-bold uppercase tracking-tighter text-on-surface">
              {users.length >= 2 ? "In Sync" : "Waiting…"}
            </span>
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT ────────────────────────── */}
      <main className="pt-24 pb-32 px-6 min-h-screen relative overflow-hidden">
        {/* Ambient orb */}
        <div className="orb-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none -z-10" />

        {/* ── NOW PLAYING (visible when tab = 'playing') ── */}
        <section
          className={`flex flex-col items-center text-center space-y-8 mt-4 ${
            activeTab !== "playing" ? "hidden md:flex" : ""
          }`}
        >
          {currentSong ? (
            <>
              {/* Visualizer + Album Art */}
              <div className="relative w-[280px] h-[280px] group">
                <div className="absolute inset-0 mesh-gradient opacity-40 rounded-[40px] animate-pulse" />
                <div className="relative w-full h-full bg-surface-container-highest/30 backdrop-blur-md rounded-[40px] flex items-center justify-center overflow-hidden border border-white/5">
                  {/* Thumbnail */}
                  <img
                    src={currentSong.thumbnail || getThumbnail(currentSong.videoId)}
                    alt="Album Art"
                    className={`w-48 h-48 rounded-2xl object-cover shadow-2xl transition-transform duration-700 ${
                      isPlaying ? "album-spin" : "album-spin paused"
                    }`}
                  />
                  {/* Spinning ring */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className={`w-[240px] h-[240px] border-[1px] border-dashed border-primary/20 rounded-full ${
                        isPlaying
                          ? "animate-[spin_10s_linear_infinite]"
                          : ""
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Visualizer bars */}
              <div className="flex items-end justify-center gap-[3px] h-8">
                {vizBars}
              </div>

              {/* Song info */}
              <div className="space-y-2">
                <h1 className="text-3xl font-headline font-bold tracking-tight text-on-surface">
                  {currentSong.title}
                </h1>
                <p className="text-primary font-medium tracking-wide">
                  {currentSong.channelName}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <span className="text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-[0.2em]">
                    Added by
                  </span>
                  <span className="text-[11px] font-bold text-secondary uppercase tracking-[0.1em] px-2 py-0.5 bg-secondary-container/20 rounded-md">
                    {currentSong.addedBy} 💜
                  </span>
                </div>
              </div>

              {/* Seek bar */}
              <div className="w-full max-w-sm space-y-3 px-2">
                <div
                  className="seek-container h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden"
                  onClick={handleSeek}
                >
                  <div
                    className="h-full bg-gradient-to-r from-primary-container to-secondary-container rounded-full relative transition-[width] duration-300"
                    style={{ width: `${seekPct}%` }}
                  >
                    <div className="seek-thumb" />
                  </div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-outline uppercase tracking-widest">
                  <span>{formatTime(playerTime)}</span>
                  <span>{formatTime(playerDuration)}</span>
                </div>
              </div>

              {/* Playback controls */}
              <div className="flex items-center gap-10">
                <button
                  onClick={handlePrevious}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-3xl">
                    skip_previous
                  </span>
                </button>
                <button
                  onClick={handlePlayPause}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-container to-secondary-container flex items-center justify-center celestial-glow hover:scale-105 active:scale-95 transition-all duration-300"
                >
                  <span
                    className="material-symbols-outlined text-white text-5xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {isPlaying ? "pause" : "play_arrow"}
                  </span>
                </button>
                <button
                  onClick={handleSkip}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-3xl">
                    skip_next
                  </span>
                </button>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center pt-20 space-y-4">
              <div className="w-32 h-32 rounded-full border-2 border-dashed border-outline-variant/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-6xl text-outline/30">
                  music_note
                </span>
              </div>
              <h2 className="text-xl font-headline font-bold text-on-surface-variant">
                Waiting for a song…
              </h2>
              <p className="text-sm text-outline max-w-xs">
                Paste a YouTube link in the queue below to start listening
                together.
              </p>
            </div>
          )}
        </section>

        {/* ── QUEUE SECTION ─────────────────────── */}
        <section
          className={`mt-16 space-y-6 max-w-lg mx-auto ${
            activeTab !== "queue" ? "hidden md:block" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-xl font-bold tracking-tight">
              Up Next
            </h3>
            <span className="text-xs font-bold text-outline-variant uppercase tracking-widest">
              {queue.length} {queue.length === 1 ? "Track" : "Tracks"}
            </span>
          </div>

          {/* Add to queue */}
          <div className="relative group">
            <input
              id="add-song-input"
              type="text"
              className="w-full bg-surface-container-lowest border-none rounded-xl py-4 pl-12 pr-24 text-sm font-medium focus:ring-1 focus:ring-primary/40 placeholder:text-outline/50 transition-all"
              placeholder="Paste YouTube URL…"
              value={songUrl}
              onChange={(e) => setSongUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSong();
              }}
            />
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/60">
              add_circle
            </span>
            <button
              onClick={handleAddSong}
              disabled={isAddingSong || !songUrl.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 gradient-button text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-30 transition-opacity"
            >
              {isAddingSong ? "Adding…" : "Add"}
            </button>
          </div>

          {/* Queue items */}
          <div className="space-y-3">
            {queue.map((song, idx) => {
              const isCurrent = idx === roomState?.currentIndex;
              return (
                <div
                  key={song.id}
                  className={`queue-item-enter flex items-center gap-4 p-3 rounded-2xl transition-colors group ${
                    isCurrent
                      ? "bg-surface-container-high border-l-[3px] border-primary-container"
                      : "bg-surface-container-low hover:bg-surface-container-high"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container-highest flex-shrink-0 relative">
                    <img
                      src={song.thumbnail || getThumbnail(song.videoId)}
                      alt=""
                      className={`w-full h-full object-cover ${
                        !isCurrent ? "opacity-60" : ""
                      }`}
                    />
                    {isCurrent && isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex items-end gap-[2px] h-4">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="viz-bar !w-[2px] !h-4"
                              style={{
                                animationDelay: `${i * 0.15}s`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Song info */}
                  <div className="flex-1 min-w-0">
                    <h4
                      className={`text-sm font-bold truncate ${
                        !isCurrent ? "opacity-60" : ""
                      }`}
                    >
                      {song.title}
                    </h4>
                    <p
                      className={`text-[11px] text-outline font-medium ${
                        !isCurrent ? "opacity-60" : ""
                      }`}
                    >
                      {song.channelName}
                    </p>
                  </div>

                  {/* Added by tag */}
                  <div className="text-right flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                        song.addedBy === userName
                          ? "text-primary-container bg-primary-container/10"
                          : "text-secondary bg-secondary-container/10"
                      } ${!isCurrent ? "opacity-60" : ""}`}
                    >
                      {song.addedBy}
                    </span>
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveSong(song.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-outline hover:text-error text-sm"
                      title="Remove from queue"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        close
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Empty queue */}
            {queue.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 rounded-full border border-dashed border-outline-variant/30 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl text-outline/30">
                    queue_music
                  </span>
                </div>
                <p className="text-sm text-outline">
                  Add a song to get started 🎵
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ── BOTTOM NAV (Mobile) ─────────────────── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-12 pb-8 pt-4 bg-slate-950/60 backdrop-blur-2xl rounded-t-[40px] shadow-[0_-10px_40px_rgba(233,30,140,0.1)] md:hidden">
        <button
          onClick={() => setActiveTab("playing")}
          className={`flex flex-col items-center justify-center transition-all duration-300 ${
            activeTab === "playing"
              ? "text-pink-500 scale-110"
              : "text-slate-500 hover:text-slate-200"
          }`}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontVariationSettings:
                activeTab === "playing" ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            music_note
          </span>
          <span className="font-headline text-[10px] font-semibold uppercase tracking-widest mt-1">
            Now Playing
          </span>
          {activeTab === "playing" && (
            <div className="w-1 h-1 bg-pink-500 rounded-full mt-1" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex flex-col items-center justify-center transition-all duration-300 ${
            activeTab === "queue"
              ? "text-pink-500 scale-110"
              : "text-slate-500 hover:text-slate-200"
          }`}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontVariationSettings:
                activeTab === "queue" ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            queue_music
          </span>
          <span className="font-headline text-[10px] font-semibold uppercase tracking-widest mt-1">
            Queue
          </span>
          {activeTab === "queue" && (
            <div className="w-1 h-1 bg-pink-500 rounded-full mt-1" />
          )}
        </button>
      </nav>
    </div>
  );
}
