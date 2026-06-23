import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported() || !("Notification" in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPush(
  publicKey: string,
): Promise<PushSubscriptionJSON | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing.toJSON();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  return subscription.toJSON();
}

export async function savePushSubscription(
  tripCode: string,
  memberId: string,
  subscription: PushSubscriptionJSON,
): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, "trips", tripCode, "pushSubscriptions", memberId), {
    subscription,
  });
}

export async function notifyTripMembers(
  tripCode: string,
  title: string,
  body: string,
  senderId: string,
  url?: string,
): Promise<void> {
  await fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tripCode, title, body, senderId, url }),
  });
}
