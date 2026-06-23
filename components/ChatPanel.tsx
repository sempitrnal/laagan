"use client";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send } from "lucide-react";
import type { Message, Trip } from "@/lib/types";
import { getMemberColor, getMemberInitials } from "@/lib/utils";

interface Props {
  messages: Message[];
  trip: Trip;
  currentMemberId: string | null;
  onSend: (text: string) => Promise<void>;
  onClose: () => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatPanel({
  messages,
  trip,
  currentMemberId,
  onSend,
  onClose,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const memberIndex = Object.fromEntries(trip.members.map((m, i) => [m.id, i]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    function onResize() {
      const offset = window.innerHeight - (vv!.height + vv!.offsetTop);
      document.getElementById("chat-input-bar")!.style.paddingBottom =
        offset > 0 ? `${offset}px` : "env(safe-area-inset-bottom, 8px)";
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !currentMemberId || sending) return;
    setSending(true);
    setText("");
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const days: { label: string; msgs: Message[] }[] = [];
  let currentDay = "";
  for (const msg of messages) {
    const label = formatDay(msg.createdAt);
    if (label !== currentDay) {
      currentDay = label;
      days.push({ label, msgs: [] });
    }
    days[days.length - 1].msgs.push(msg);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-sand"
      style={{ height: "100dvh" }}
    >
      {/* Header */}
      <div
        className="bg-ocean-dark text-white px-4 flex items-center gap-3 shrink-0"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          paddingBottom: "12px",
        }}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-none">Group Chat</p>
          <p className="text-xs text-white/60 mt-0.5">
            {trip.name} · {trip.members.length} members
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-4xl mb-2">💬</span>
            <p className="font-semibold text-night">No messages yet</p>
            <p className="text-xs text-muted mt-1">Start the group chat!</p>
          </div>
        )}

        {days.map((day) => (
          <div key={day.label}>
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-warmgray" />
              <span className="text-[10px] font-medium text-muted px-2 shrink-0">
                {day.label}
              </span>
              <div className="flex-1 h-px bg-warmgray" />
            </div>

            <div className="space-y-2">
              {day.msgs.map((msg) => {
                const isMe = msg.senderId === currentMemberId;
                const idx = memberIndex[msg.senderId] ?? 0;
                const color = getMemberColor(idx);

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                  >
                    {!isMe && (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mb-4"
                        style={{ backgroundColor: color }}
                      >
                        {getMemberInitials(msg.senderName)}
                      </div>
                    )}
                    <div
                      className={`max-w-[72%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
                    >
                      {!isMe && (
                        <span className="text-[10px] font-medium text-muted ml-1">
                          {msg.senderName}
                        </span>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-snug ${
                          isMe
                            ? "bg-ocean text-white rounded-br-sm"
                            : "bg-white text-night rounded-bl-sm shadow-sm"
                        }`}
                        style={{ wordBreak: "break-word" }}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-muted px-1">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar — stays above keyboard via visualViewport padding */}
      <div
        id="chat-input-bar"
        className="bg-white border-t border-warmgray px-3 pt-2 flex items-center gap-2 shrink-0"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
      >
        {currentMemberId ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message the group…"
              className="flex-1 bg-sand rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ocean/30 placeholder:text-muted"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-9 h-9 rounded-full bg-ocean text-white flex items-center justify-center shrink-0 disabled:opacity-40 btn-press transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </>
        ) : (
          <p className="text-xs text-muted text-center w-full py-2">
            Select your name above to chat
          </p>
        )}
      </div>
    </div>
  );
}
