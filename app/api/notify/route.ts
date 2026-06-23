import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function POST(req: NextRequest) {
  const { tripCode, title, body, senderId, url } = await req.json();

  if (!tripCode || !title || !body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 500 },
    );
  }

  if (!db) {
    return NextResponse.json(
      { error: "Firestore not configured" },
      { status: 500 },
    );
  }

  const subsSnapshot = await getDocs(
    collection(db, "trips", tripCode, "pushSubscriptions"),
  );
  const subscriptions = subsSnapshot.docs
    .map((doc) => {
      const data = doc.data() as { subscription: webPush.PushSubscription; memberId?: string };
      return { memberId: doc.id, ...data };
    })
    .filter((sub) => sub.memberId !== senderId);

  const payload = JSON.stringify({ title, body, url, tag: tripCode });
  const results = await Promise.allSettled(
    subscriptions.map((sub) => webPush.sendNotification(sub.subscription, payload)),
  );

  return NextResponse.json({ sent: subscriptions.length, results });
}
