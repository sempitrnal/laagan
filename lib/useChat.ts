"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { doc, setDoc, collection, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import type { Typing } from "./types";

export interface ChatState {
  typingUsers: Typing[];
  readStatus: Record<string, number>;
  setTyping: (isTyping: boolean) => Promise<void>;
  markRead: () => Promise<void>;
}

export function useChat(
  code: string,
  currentMemberId: string | null,
  currentMemberName: string | null,
): ChatState {
  const [typingUsers, setTypingUsers] = useState<Typing[]>([]);
  const [readStatus, setReadStatus] = useState<Record<string, number>>({});
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !code) return;

    const typingCol = collection(db, "trips", code, "typing");
    const unsubTyping = onSnapshot(typingCol, (snap) => {
      const now = Date.now();
      setTypingUsers(
        snap.docs
          .map((d) => d.data() as Typing)
          .filter(
            (t) =>
              t.memberId !== currentMemberId &&
              t.isTyping &&
              now - t.updatedAt < 6000,
          ),
      );
    });

    const readCol = collection(db, "trips", code, "readStatus");
    const unsubRead = onSnapshot(readCol, (snap) => {
      const status: Record<string, number> = {};
      snap.docs.forEach((d) => {
        status[d.id] = (d.data() as { lastRead: number }).lastRead;
      });
      setReadStatus(status);
    });

    return () => {
      unsubTyping();
      unsubRead();
    };
  }, [code, currentMemberId]);

  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (
        !isFirebaseConfigured ||
        !db ||
        !currentMemberId ||
        !currentMemberName
      )
        return;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      const typingDoc = doc(db, "trips", code, "typing", currentMemberId);
      await setDoc(typingDoc, {
        memberId: currentMemberId,
        name: currentMemberName,
        isTyping,
        updatedAt: Date.now(),
      });
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => setTyping(false), 5000);
      }
    },
    [code, currentMemberId, currentMemberName],
  );

  const markRead = useCallback(async () => {
    if (!isFirebaseConfigured || !db || !currentMemberId) return;
    const readDoc = doc(db, "trips", code, "readStatus", currentMemberId);
    await setDoc(readDoc, { lastRead: Date.now() });
  }, [code, currentMemberId]);

  return { typingUsers, readStatus, setTyping, markRead };
}
