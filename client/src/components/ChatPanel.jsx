import { useState, useRef, useEffect } from "react";

/**
 * ChatPanel — real-time chat component for SyncListen.
 * Renders messages with proper alignment (self vs partner vs system),
 * auto-scrolls, and supports Enter to send.
 */
export default function ChatPanel({ messages, userName, onSend, socketId }) {
  const [text, setText] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="chat-panel flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className="material-symbols-outlined text-secondary text-[18px]">
          chat_bubble
        </span>
        <h3 className="font-headline text-sm font-bold tracking-tight text-on-surface">
          Messages
        </h3>
        <span className="text-[10px] font-bold text-outline-variant uppercase tracking-widest ml-auto">
          {messages.length} {messages.length === 1 ? "msg" : "msgs"}
        </span>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 chat-scroll"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <span className="material-symbols-outlined text-4xl text-outline/40 mb-3">
              forum
            </span>
            <p className="text-xs text-outline font-medium">
              No messages yet. Say hi! 💜
            </p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.type === "system") {
            return (
              <div key={msg.id} className="chat-msg-system">
                <span className="text-[10px] text-outline/60 font-medium italic">
                  {msg.text}
                </span>
              </div>
            );
          }

          const isSelf = msg.senderId === socketId;
          return (
            <div
              key={msg.id}
              className={`chat-msg-row ${isSelf ? "chat-msg-self" : "chat-msg-other"}`}
            >
              {/* Avatar for other user */}
              {!isSelf && (
                <div className="chat-avatar bg-gradient-to-br from-secondary-container to-secondary">
                  {msg.sender?.[0]?.toUpperCase() || "?"}
                </div>
              )}

              <div className={`chat-bubble ${isSelf ? "chat-bubble-self" : "chat-bubble-other"}`}>
                {!isSelf && (
                  <span className="chat-sender text-secondary">
                    {msg.sender}
                  </span>
                )}
                <p className="chat-text">{msg.text}</p>
                <span className="chat-time">
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>

              {/* Avatar for self */}
              {isSelf && (
                <div className="chat-avatar bg-gradient-to-br from-primary-container to-primary">
                  {msg.sender?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="relative">
          <input
            ref={inputRef}
            id="chat-input"
            type="text"
            className="w-full bg-surface-container-lowest border-none rounded-xl py-3 pl-4 pr-14 text-sm font-medium focus:ring-1 focus:ring-secondary/40 placeholder:text-outline/40 transition-all outline-none"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={500}
            autoComplete="off"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-gradient-to-br from-secondary-container to-secondary flex items-center justify-center disabled:opacity-20 transition-opacity hover:scale-105 active:scale-95"
          >
            <span className="material-symbols-outlined text-white text-[18px]">
              send
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
