"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import type { Trip, Expense, Member } from "./types";
import { generateId } from "./utils";

const TRIP_KEY = (code: string) => `wt_trip_${code}`;
const EXPENSES_KEY = (code: string) => `wt_expenses_${code}`;

function loadLocalTrip(code: string): Trip | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TRIP_KEY(code));
  return raw ? (JSON.parse(raw) as Trip) : null;
}

function loadLocalExpenses(code: string): Expense[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(EXPENSES_KEY(code));
  return raw ? (JSON.parse(raw) as Expense[]) : [];
}

function saveLocalTrip(trip: Trip) {
  localStorage.setItem(TRIP_KEY(trip.id), JSON.stringify(trip));
}

function saveLocalExpenses(code: string, expenses: Expense[]) {
  localStorage.setItem(EXPENSES_KEY(code), JSON.stringify(expenses));
}

export type UseTripResult = {
  trip: Trip | null;
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  usingFirebase: boolean;
  addExpense: (expense: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  updateExpense: (
    expenseId: string,
    updates: Partial<Omit<Expense, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  addMember: (name: string) => Promise<Member>;
  updateBudget: (amount: number) => Promise<void>;
};

export function useTrip(code: string): UseTripResult {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tripRef = useRef<Trip | null>(null);
  tripRef.current = trip;

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);
    setTrip(null);
    setExpenses([]);

    if (isFirebaseConfigured && db) {
      const tripDoc = doc(db, "trips", code);
      const expensesCol = collection(db, "trips", code, "expenses");
      const expensesQ = query(expensesCol, orderBy("createdAt", "desc"));

      let tripReady = false;
      let expReady = false;
      const checkDone = () => {
        if (tripReady && expReady) setLoading(false);
      };

      const unsubTrip = onSnapshot(
        tripDoc,
        (snap) => {
          if (!snap.exists()) {
            setError("Trip not found");
            setLoading(false);
            return;
          }
          setTrip({ id: snap.id, ...(snap.data() as Omit<Trip, "id">) });
          tripReady = true;
          checkDone();
        },
        (err) => {
          setError("Could not load trip: " + err.message);
          setLoading(false);
        },
      );

      const unsubExp = onSnapshot(
        expensesQ,
        (snap) => {
          setExpenses(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Expense, "id">),
            })),
          );
          expReady = true;
          checkDone();
        },
        (err) => {
          console.error("Expenses subscription error:", err);
          expReady = true;
          checkDone();
        },
      );

      return () => {
        unsubTrip();
        unsubExp();
      };
    } else {
      const t = loadLocalTrip(code);
      if (!t) {
        setError("Trip not found");
      } else {
        setTrip(t);
        setExpenses(loadLocalExpenses(code));
      }
      setLoading(false);
    }
  }, [code]);

  const addExpense = useCallback(
    async (expense: Omit<Expense, "id" | "createdAt">) => {
      const newExpense: Expense = {
        ...expense,
        id: generateId(),
        createdAt: Date.now(),
      };

      if (isFirebaseConfigured && db) {
        const expenseDoc = doc(collection(db, "trips", code, "expenses"));
        await setDoc(expenseDoc, {
          description: newExpense.description,
          amount: newExpense.amount,
          category: newExpense.category,
          paidBy: newExpense.paidBy,
          date: newExpense.date,
          splits: newExpense.splits,
          createdAt: newExpense.createdAt,
          createdBy: newExpense.createdBy,
          isPrivate: newExpense.isPrivate ?? false,
          isSettlement: newExpense.isSettlement ?? false,
        });
      } else {
        setExpenses((prev) => {
          const updated = [newExpense, ...prev];
          saveLocalExpenses(code, updated);
          return updated;
        });
      }
    },
    [code],
  );

  const updateExpense = useCallback(
    async (
      expenseId: string,
      updates: Partial<Omit<Expense, "id" | "createdAt">>,
    ) => {
      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, "trips", code, "expenses", expenseId), updates);
      } else {
        setExpenses((prev) => {
          const updated = prev.map((e) =>
            e.id === expenseId ? { ...e, ...updates } : e,
          );
          saveLocalExpenses(code, updated);
          return updated;
        });
      }
    },
    [code],
  );

  const deleteExpense = useCallback(
    async (expenseId: string) => {
      if (isFirebaseConfigured && db) {
        await deleteDoc(doc(db, "trips", code, "expenses", expenseId));
      } else {
        setExpenses((prev) => {
          const updated = prev.filter((e) => e.id !== expenseId);
          saveLocalExpenses(code, updated);
          return updated;
        });
      }
    },
    [code],
  );

  const addMember = useCallback(
    async (name: string): Promise<Member> => {
      const current = tripRef.current;
      if (!current) throw new Error("Trip not loaded");
      const newMember: Member = { id: generateId(), name };
      const updatedMembers = [...current.members, newMember];

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, "trips", code), { members: updatedMembers });
      } else {
        const updated: Trip = { ...current, members: updatedMembers };
        saveLocalTrip(updated);
        setTrip(updated);
      }

      return newMember;
    },
    [code],
  );

  const updateBudget = useCallback(
    async (amount: number) => {
      const current = tripRef.current;
      if (!current) throw new Error("Trip not loaded");

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, "trips", code), { totalBudget: amount });
      } else {
        const updated: Trip = { ...current, totalBudget: amount };
        saveLocalTrip(updated);
        setTrip(updated);
      }
    },
    [code],
  );

  return {
    trip,
    expenses,
    loading,
    error,
    usingFirebase: isFirebaseConfigured,
    addExpense,
    updateExpense,
    deleteExpense,
    addMember,
    updateBudget,
  };
}
