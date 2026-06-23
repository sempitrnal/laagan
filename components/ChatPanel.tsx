"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Send, CheckCheck, Image, ImagePlus } from "lucide-react";
import type { Message, Trip } from "@/lib/types";
import { getMemberColor, getMemberInitials } from "@/lib/utils";
import { useChat } from "@/lib/useChat";
import { uploadChatImage } from "@/lib/tripService";
import {
  requestNotificationPermission,
  subscribeToPush,
  savePushSubscription,
  notifyTripMembers,
} from "@/lib/notifications";
import { playSendSound, playNotifySound, unlockAudio } from "@/lib/sounds";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const IMAGE_HOSTS = [
  "media.giphy.com",
  "media.tenor.com",
  "i.imgur.com",
  "imgur.com",
  "cdn.discordapp.com",
  "media.discordapp.net",
  "firebasestorage.googleapis.com",
];

function isImageUrl(url: string) {
  if (url.startsWith("data:image/")) return true;
  const directImage = /\.(gif|jpg|jpeg|png|webp|bmp|svg)(\?.*)?$/i.test(url);
  const knownHost = IMAGE_HOSTS.some((host) =>
    url.toLowerCase().includes(host),
  );
  return directImage || knownHost;
}

function renderMessageContent(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (!part.match(/^https?:\/\//)) {
      return <span key={i}>{part}</span>;
    }
    if (isImageUrl(part)) {
      return (
        <img
          key={i}
          src={part}
          alt="GIF"
          loading="lazy"
          className="max-w-full max-h-48 rounded-lg mt-1 block"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      );
    }
    return (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="underline break-all"
      >
        {part}
      </a>
    );
  });
}

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
  const [showGifInput, setShowGifInput] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCount = useRef(messages.length);
  const memberIndex = Object.fromEntries(trip.members.map((m, i) => [m.id, i]));
  const currentMember =
    trip.members.find((m) => m.id === currentMemberId) ?? null;

  const { typingUsers, readStatus, setTyping, markRead } = useChat(
    trip.id,
    currentMemberId,
    currentMember?.name ?? null,
  );

  /* ── Keyboard fix via visualViewport ─────── */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      if (!containerRef.current) return;
      containerRef.current.style.height = `${vv!.height}px`;
      containerRef.current.style.top = `${vv!.offsetTop}px`;
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  /* ── Auto-focus GIF input when shown ─────── */
  useEffect(() => {
    if (showGifInput) gifInputRef.current?.focus();
  }, [showGifInput]);

  /* ── Subscribe to push notifications ─────── */
  useEffect(() => {
    if (!currentMemberId) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    const memberId = currentMemberId;
    const key = vapidKey;
    async function init() {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      const subscription = await subscribeToPush(key);
      if (subscription) {
        await savePushSubscription(trip.id, memberId, subscription);
      }
    }
    init().catch(() => {});
  }, [currentMemberId, trip.id]);

  /* ── Auto-scroll ─────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers.length]);

  /* ── Mark read on open / new messages ────── */
  useEffect(() => {
    markRead();
  }, [messages.length, markRead]);

  /* ── Notify sound for incoming messages ───── */
  useEffect(() => {
    const prev = prevMsgCount.current;
    prevMsgCount.current = messages.length;
    if (messages.length <= prev) return;
    const latest = messages[messages.length - 1];
    if (latest && latest.senderId !== currentMemberId) {
      playNotifySound();
    }
  }, [messages, currentMemberId]);

  /* ── Unlock audio on first touch ─────────── */
  useEffect(() => {
    const handler = () => unlockAudio();
    window.addEventListener("touchstart", handler, { once: true });
    return () => window.removeEventListener("touchstart", handler);
  }, []);

  const handleTyping = useCallback(
    (val: string) => {
      setText(val);
      setTyping(val.length > 0);
    },
    [setTyping],
  );

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !currentMemberId || sending) return;
    await submitMessage(trimmed);
    setText("");
    inputRef.current?.focus();
  }

  async function handleGifSend() {
    const trimmed = gifUrl.trim();
    if (!trimmed || !currentMemberId || sending) return;
    await submitMessage(trimmed);
    setGifUrl("");
    setShowGifInput(false);
  }

  async function submitMessage(content: string) {
    if (!currentMemberId) return;
    setSending(true);
    setTyping(false);
    playSendSound();
    try {
      await onSend(content);
      const sender = trip.members.find((m) => m.id === currentMemberId);
      const body = isImageUrl(content)
        ? "Sent an image"
        : content.slice(0, 100);
      await notifyTripMembers(
        trip.id,
        sender?.name ?? "Someone",
        body,
        currentMemberId,
        `/trip/${trip.id}`,
      );
    } catch {
      // Notification failures are non-fatal
    } finally {
      setSending(false);
    }
  }

  async function handleImageUpload(file: File) {
    if (!file || !currentMemberId) return;
    if (!file.type.startsWith("image/")) return;
    setUploadingImage(true);
    try {
      const url = await uploadChatImage(trip.id, file);
      await submitMessage(url);
    } catch (e) {
      console.error("Image upload failed", e);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /* ── Group by day ────────────────────────── */
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

  /* ── Read receipt helpers ─────────────────── */
  const otherMembers = trip.members.filter((m) => m.id !== currentMemberId);
  function readersOf(msg: Message) {
    return otherMembers.filter((m) => {
      const lr = readStatus[m.id] ?? 0;
      if (lr < msg.createdAt) return false;
      const hasLater = messages.some(
        (m2) => m2.createdAt > msg.createdAt && m2.createdAt <= lr,
      );
      return !hasLater;
    });
  }

  return (
    <div
      ref={containerRef}
      className="fixed left-0 right-0 z-50 flex flex-col bg-sand overflow-hidden"
      style={{ top: 0, height: "100dvh" }}
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
          {typingUsers.length > 0 ? (
            <p className="text-xs text-white/70 mt-0.5 italic">
              {typingUsers.map((t) => t.name).join(", ")} typing…
            </p>
          ) : (
            <p className="text-xs text-white/60 mt-0.5">
              {trip.name} · {trip.members.length} members
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-1 min-h-0">
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

            <div className="space-y-1.5">
              {day.msgs.map((msg) => {
                const isMe = msg.senderId === currentMemberId;
                const idx = memberIndex[msg.senderId] ?? 0;
                const color = getMemberColor(idx);
                const seenBy = isMe ? readersOf(msg) : [];

                return (
                  <div key={msg.id}>
                    <div
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
                          {renderMessageContent(msg.text)}
                        </div>
                        <div
                          className={`flex items-center gap-1 px-1 ${isMe ? "flex-row-reverse" : ""}`}
                        >
                          <span className="text-[10px] text-muted">
                            {formatTime(msg.createdAt)}
                          </span>
                          {isMe && seenBy.length > 0 && (
                            <CheckCheck className="w-3 h-3 text-ocean" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Read avatars */}
                    {isMe && seenBy.length > 0 && (
                      <div className="flex justify-end gap-0.5 pr-1 -mt-0.5 mb-1">
                        {seenBy.map((m) => (
                          <div
                            key={m.id}
                            title={`Seen by ${m.name}`}
                            className="w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-white font-bold"
                            style={{
                              fontSize: "7px",
                              backgroundColor: getMemberColor(
                                memberIndex[m.id] ?? 0,
                              ),
                            }}
                          >
                            {getMemberInitials(m.name)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-end gap-2 mt-2 pl-1">
            <div className="flex gap-1 px-3 py-2.5 bg-white rounded-2xl rounded-bl-sm shadow-sm">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-muted/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="bg-white border-t border-warmgray px-3 pt-2 flex flex-col shrink-0"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
      >
        {showGifInput && currentMemberId && (
          <div className="flex items-center gap-2 mb-2">
            <input
              ref={gifInputRef}
              type="text"
              value={gifUrl}
              onChange={(e) => setGifUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGifSend();
                }
              }}
              placeholder="Paste GIF/image URL (Giphy, Tenor, Imgur...)"
              className="flex-1 bg-sand rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ocean/30 placeholder:text-muted"
            />
            <button
              onClick={handleGifSend}
              disabled={!gifUrl.trim() || sending}
              className="px-3 h-9 rounded-full bg-ocean text-white text-xs font-semibold flex items-center justify-center shrink-0 disabled:opacity-40 btn-press transition-opacity"
            >
              Send GIF
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {currentMemberId ? (
            <>
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message the group…"
                className="flex-1 bg-sand rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ocean/30 placeholder:text-muted"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="w-9 h-9 rounded-full bg-sand text-ocean flex items-center justify-center shrink-0 btn-press transition-opacity disabled:opacity-40"
                title="Send a photo"
              >
                {uploadingImage ? (
                  <span className="w-4 h-4 border-2 border-ocean border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setShowGifInput((s) => !s)}
                className="w-9 h-9 rounded-full bg-sand text-ocean flex items-center justify-center shrink-0 btn-press transition-opacity"
                title="Send a GIF"
              >
                <Image className="w-4 h-4" />
              </button>
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
    </div>
  );
}
