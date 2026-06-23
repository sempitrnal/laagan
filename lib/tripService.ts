import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, isFirebaseConfigured } from "./firebase";
import type { Trip, Member } from "./types";
import { generateTripCode, generateId } from "./utils";

const TRIP_KEY = (code: string) => `wt_trip_${code}`;
const EXPENSES_KEY = (code: string) => `wt_expenses_${code}`;

function saveLocalTrip(trip: Trip) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TRIP_KEY(trip.id), JSON.stringify(trip));
  if (!localStorage.getItem(EXPENSES_KEY(trip.id))) {
    localStorage.setItem(EXPENSES_KEY(trip.id), JSON.stringify([]));
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

export async function createTrip(
  data: Pick<Trip, "name" | "destination" | "currency" | "totalBudget">,
  creatorName: string,
): Promise<{ tripCode: string; memberId: string }> {
  const tripCode = generateTripCode();
  const memberId = generateId();
  const trip: Trip = {
    ...data,
    id: tripCode,
    members: [{ id: memberId, name: creatorName }],
    createdAt: Date.now(),
  };

  if (isFirebaseConfigured && db) {
    console.log(
      "[Firebase] Creating trip",
      tripCode,
      "in project",
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    );
    try {
      await withTimeout(
        setDoc(doc(db, "trips", tripCode), {
          name: trip.name,
          destination: trip.destination,
          currency: trip.currency,
          totalBudget: trip.totalBudget,
          members: trip.members,
          createdAt: trip.createdAt,
        }),
        8000,
        "Firestore setDoc",
      );
      console.log("[Firebase] Trip created successfully");
    } catch (err: any) {
      console.error("[Firebase] Trip creation failed:", err);
      const msg = err?.message ?? "";
      if (msg.includes("timed out")) {
        throw new Error(
          "Connection to Firebase timed out. Most likely cause: an ad blocker or privacy extension is blocking firestore.googleapis.com.\\n\\n" +
            "Fixes:\\n" +
            "1. Disable your ad blocker on localhost\\n" +
            "2. Or test in an incognito/private window",
        );
      }
      throw new Error(
        "Could not save to Firebase.\\n" +
          "Common causes:\\n" +
          "1. Ad blocker / privacy extension blocking Firestore\\n" +
          "2. Firestore database not created in Firebase Console\\n" +
          "3. Security rules blocking writes\\n" +
          "4. Invalid API key or project ID",
      );
    }
  } else {
    console.log("[Local] Creating trip", tripCode);
    saveLocalTrip(trip);
  }

  return { tripCode, memberId };
}

export async function checkTripExists(code: string): Promise<Trip | null> {
  const upper = code.toUpperCase().trim();
  if (isFirebaseConfigured && db) {
    const snap = await getDoc(doc(db, "trips", upper));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Trip;
  }
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TRIP_KEY(upper));
  return raw ? (JSON.parse(raw) as Trip) : null;
}

export async function addMemberToTrip(
  code: string,
  name: string,
  currentTrip: Trip,
): Promise<{ memberId: string }> {
  const memberId = generateId();
  const newMember: Member = { id: memberId, name };
  const updatedMembers = [...currentTrip.members, newMember];

  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, "trips", code), { members: updatedMembers });
  } else {
    const updated: Trip = { ...currentTrip, members: updatedMembers };
    saveLocalTrip(updated);
  }

  return { memberId };
}

export function uploadChatImage(code: string, file: File): Promise<string> {
  if (!isFirebaseConfigured || !storage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}_${generateId()}.${ext}`;
  const fileRef = ref(storage, `trips/${code}/images/${filename}`);
  return uploadBytes(fileRef, file).then(() => getDownloadURL(fileRef));
}
