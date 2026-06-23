"use client";
import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import type { Message, Trip } from "@/lib/types";
import { getMemberColor, getMemberInitials } from "@/lib/utils";

interface Props {
  messages: Message[];
  trip: Trip;
  currentMemberId: string | null;
  onSend: (text: string) => Promise<void>;
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
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const memberIndex = Object.fromEntries(trip.members.map((m, i) => [m.id, i]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !currentMemberId || sending) return;
    setSending(true);
    setText("");
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
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
      className="flex flex-col bg-white rounded-2xl border border-warmgray shadow-sm overflow-hidden"
      style={{ height: "60vh" }}
    >
      {/* Messages area */}
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
                        className={`px-3 py-2 rounded-2xl text-sm leading-snug break-words ${
                          isMe
                            ? "bg-ocean text-white rounded-br-sm"
                            : "bg-sand text-night rounded-bl-sm"
                        }`}
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

      {/* Input bar */}
      <div className="border-t border-warmgray px-3 py-2.5 flex items-center gap-2 bg-white shrink-0">
        {currentMemberId ? (
          <>
            <input
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
              className="flex-1 bg-sand rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ocean/30 placeholder:text-muted"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-9 h-9 rounded-xl bg-ocean text-white flex items-center justify-center shrink-0 disabled:opacity-40 btn-press transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </>
        ) : (
          <p className="text-xs text-muted text-center w-full py-1.5">
            Select your name above to chat
          </p>
        )}
      </div>
    </div>
  );
}
