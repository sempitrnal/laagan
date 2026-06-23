"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Share2,
  Users,
  Wallet,
  ReceiptText,
  Scale,
  Trash2,
  MessageCircle,
  Pencil,
  UserPlus,
  Wifi,
  WifiOff,
  MapPin,
} from "lucide-react";
import { useTrip } from "@/lib/useTrip";
import {
  formatAmount,
  getCategoryTotals,
  CATEGORY_COLORS,
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORIES,
  getMemberColor,
  getMemberInitials,
  formatDate,
  getCurrencySymbol,
  todayISO,
} from "@/lib/utils";
import type { Category, Expense } from "@/lib/types";
import AddExpenseModal from "./AddExpenseModal";
import BalanceSheet from "./BalanceSheet";
import ChatPanel from "./ChatPanel";
import PullToRefresh from "./PullToRefresh";
import ShareModal from "./ShareModal";
import { playNotifySound, unlockAudio } from "@/lib/sounds";

interface Props {
  tripCode: string;
}

/* ── Animated counter ─────────────────────────── */
function AnimatedNumber({
  value,
  currency,
}: {
  value: number;
  currency: string;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const dur = 700;

    cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    rafRef.current = requestAnimationFrame(function tick(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{formatAmount(display, currency)}</>;
}

/* ── Budget progress card ─────────────────────── */
function BudgetCard({
  totalBudget,
  totalSpent,
  currency,
  members,
  expenses,
  onEdit,
}: {
  totalBudget: number;
  totalSpent: number;
  currency: string;
  members: Array<{ id: string; name: string }>;
  expenses: Expense[];
  onEdit: (amount: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(totalBudget));
  const [saving, setSaving] = useState(false);

  const remaining = totalBudget - totalSpent;
  const pct =
    totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const overBudget = remaining < 0;

  const memberTotals = members.map((m, i) => ({
    ...m,
    idx: i,
    amount: expenses
      .filter((e) => e.paidBy === m.id && !e.isSettlement)
      .reduce((s, e) => s + e.amount, 0),
  }));
  const maxMemberAmount = Math.max(...memberTotals.map((m) => m.amount), 1);

  const barColor = pct < 70 ? "#2A7A56" : pct < 90 ? "#E8A917" : "#D94F3A";

  const handleSave = async () => {
    const val = parseFloat(editValue);
    if (Number.isNaN(val) || val < 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onEdit(val);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-warmgray p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-ocean" />
          <span className="text-sm font-semibold text-night">Budget</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-medium">
            {pct.toFixed(0)}% used
          </span>
          {!editing && (
            <button
              onClick={() => {
                setEditValue(String(totalBudget));
                setEditing(true);
              }}
              className="p-1 rounded-md hover:bg-sand text-muted hover:text-ocean transition-colors"
              title="Edit budget"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 5.732z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex items-center gap-2 mb-4 animate-fade-in">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-medium">
              {getCurrencySymbol(currency)}
            </span>
            <input
              type="number"
              min="1"
              step="any"
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-full pl-7 pr-3 py-2 rounded-xl border-2 border-ocean text-night text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 rounded-xl bg-ocean text-white text-sm font-semibold hover:bg-ocean-dark transition-colors disabled:opacity-60"
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-2 rounded-xl border-2 border-warmgray text-muted text-sm font-semibold hover:bg-sand transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {totalBudget > 0 ? (
        <>
          {/* Progress track */}
          <div className="relative h-5 bg-sand rounded-full overflow-hidden mb-4 border border-warmgray">
            <div
              className="h-full rounded-full progress-bar-fill transition-all duration-700 relative overflow-hidden"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            >
              {/* Shimmer stripe */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 2s infinite",
                }}
              />
            </div>
            {/* Plane icon on bar edge */}
            {pct > 5 && pct < 100 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-base pointer-events-none"
                style={{ left: `${pct}%` }}
              >
                ✈️
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-[11px] text-muted mb-0.5 uppercase tracking-wide font-medium">
                Budget
              </p>
              <p className="text-sm font-bold text-night">
                <AnimatedNumber value={totalBudget} currency={currency} />
              </p>
            </div>
            <div className="text-center border-x border-warmgray">
              <p className="text-[11px] text-muted mb-0.5 uppercase tracking-wide font-medium">
                Spent
              </p>
              <p className="text-sm font-bold" style={{ color: barColor }}>
                <AnimatedNumber value={totalSpent} currency={currency} />
              </p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-muted mb-0.5 uppercase tracking-wide font-medium">
                {overBudget ? "Over by" : "Left"}
              </p>
              <p
                className={`text-sm font-bold ${overBudget ? "text-coral" : "text-forest"}`}
              >
                <AnimatedNumber
                  value={Math.abs(remaining)}
                  currency={currency}
                />
              </p>
            </div>
          </div>

          {/* Member breakdown */}
          <div className="space-y-2 border-t border-warmgray pt-3">
            <p className="text-[11px] text-muted uppercase tracking-wide font-medium">
              By Member
            </p>
            <div className="space-y-1.5">
              {memberTotals.map((m) => {
                if (m.amount <= 0) return null;
                const barPct = (m.amount / maxMemberAmount) * 100;
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: getMemberColor(m.idx) }}
                    >
                      {getMemberInitials(m.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-medium text-night truncate">
                          {m.name}
                        </span>
                        <span className="text-[11px] font-semibold text-ocean whitespace-nowrap ml-2">
                          {formatAmount(m.amount, currency)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-sand rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: getMemberColor(m.idx),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-3">
          <p className="text-xs text-muted">No budget set</p>
          <p className="text-2xl font-bold text-night">
            <AnimatedNumber value={totalSpent} currency={currency} />
          </p>
          <p className="text-[11px] text-muted uppercase tracking-wide font-medium">
            Total Spent
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Category breakdown ───────────────────────── */
function CategoryCard({
  totalSpent,
  totals,
  currency,
}: {
  totalSpent: number;
  totals: Record<Category, number>;
  currency: string;
}) {
  const items = CATEGORIES.filter((c) => totals[c] > 0).sort(
    (a, b) => totals[b] - totals[a],
  );
  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-warmgray p-5">
      <div className="flex items-center gap-2 mb-4">
        <ReceiptText className="w-4 h-4 text-ocean" />
        <span className="text-sm font-semibold text-night">By Category</span>
      </div>
      <div className="space-y-3">
        {items.map((cat, i) => {
          const pct = totalSpent > 0 ? (totals[cat] / totalSpent) * 100 : 0;
          return (
            <div
              key={cat}
              className="animate-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{CATEGORY_EMOJIS[cat]}</span>
                  <span className="text-xs font-medium text-night">
                    {CATEGORY_LABELS[cat]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{pct.toFixed(0)}%</span>
                  <span className="text-xs font-semibold text-night">
                    {formatAmount(totals[cat], currency)}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-sand rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full progress-bar-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: CATEGORY_COLORS[cat],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Members row ──────────────────────────────── */
function MembersCard({
  members,
  expenses,
  currency,
  onAddMember,
}: {
  members: Array<{ id: string; name: string }>;
  expenses: Expense[];
  currency: string;
  onAddMember: () => void;
}) {
  const totalByMember = Object.fromEntries(
    members.map((m) => [
      m.id,
      expenses
        .filter((e) => e.paidBy === m.id && !e.isSettlement)
        .reduce((sum, e) => sum + e.amount, 0),
    ]),
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-warmgray px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-ocean" />
          <span className="text-sm font-semibold text-night">Members</span>
        </div>
        <button
          onClick={onAddMember}
          className="btn-press flex items-center gap-1 text-xs font-semibold text-ocean hover:text-ocean-dark transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {members.map((m, i) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-sand border border-warmgray"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                style={{ backgroundColor: getMemberColor(i) }}
              >
                {getMemberInitials(m.name)}
              </div>
              <span className="text-xs font-medium text-night truncate">
                {m.name}
              </span>
            </div>
            <span className="text-xs font-semibold text-ocean whitespace-nowrap">
              {formatAmount(totalByMember[m.id], currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main TripDashboard ───────────────────────── */
export default function TripDashboard({ tripCode }: Props) {
  const router = useRouter();
  const {
    trip,
    expenses,
    messages,
    loading,
    error,
    usingFirebase,
    addExpense,
    updateExpense,
    deleteExpense,
    addMember,
    updateBudget,
    sendMessage,
  } = useTrip(tripCode);

  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [activeTab, setActiveTab] = useState<"expenses" | "balances">(
    "expenses",
  );
  const [showChat, setShowChat] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinExistingId, setJoinExistingId] = useState("");
  const [joiningLoading, setJoiningLoading] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ name: string; text: string } | null>(
    null,
  );
  const prevMsgCount = useRef(messages.length);
  const showChatRef = useRef(showChat);
  showChatRef.current = showChat;

  /* ── Request notification permission ──────── */
  useEffect(() => {
    const handler = () => unlockAudio();
    window.addEventListener("touchstart", handler, { once: true });
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    return () => window.removeEventListener("touchstart", handler);
  }, []);

  /* ── Watch for new messages outside chat ───── */
  useEffect(() => {
    const prev = prevMsgCount.current;
    prevMsgCount.current = messages.length;
    if (messages.length <= prev || showChatRef.current) return;
    const latest = messages[messages.length - 1];
    if (!latest || latest.senderId === currentMemberId) return;
    playNotifySound();
    setToast({ name: latest.senderName, text: latest.text });
    const timer = setTimeout(() => setToast(null), 4000);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`${latest.senderName} in ${trip?.name ?? "chat"}`, {
        body: latest.text,
        icon: "/icon-192.svg",
      });
    }
    return () => clearTimeout(timer);
  }, [messages, currentMemberId, trip]);

  useEffect(() => {
    const id = localStorage.getItem(`wt_me_${tripCode}`);
    if (id) setCurrentMemberId(id);
    else if (!loading && trip) setShowJoin(true);
  }, [tripCode, loading, trip]);

  useEffect(() => {
    if (trip && !loading) {
      const raw = localStorage.getItem("wt_recent_trips");
      const all: Array<{
        code: string;
        name: string;
        destination: string;
        lastAccessed: number;
      }> = raw ? JSON.parse(raw) : [];
      const filtered = all.filter((r) => r.code !== trip.id);
      filtered.unshift({
        code: trip.id,
        name: trip.name,
        destination: trip.destination,
        lastAccessed: Date.now(),
      });
      localStorage.setItem(
        "wt_recent_trips",
        JSON.stringify(filtered.slice(0, 10)),
      );
    }
  }, [trip, loading]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setMemberError("Please enter a name.");
      return;
    }
    setAddingMember(true);
    setMemberError("");
    try {
      await addMember(newMemberName.trim());
      setNewMemberName("");
      setShowAddMember(false);
    } catch {
      setMemberError("Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleJoinAsNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    if (!joinExistingId && !joinName.trim()) {
      setJoinError("Please enter your name or select yourself.");
      return;
    }
    setJoiningLoading(true);
    setJoinError("");
    try {
      let memberId = joinExistingId;
      if (!joinExistingId) {
        const member = await addMember(joinName.trim());
        memberId = member.id;
      }
      localStorage.setItem(`wt_me_${tripCode}`, memberId);
      setCurrentMemberId(memberId);
      setShowJoin(false);
    } catch {
      setJoinError("Failed to join trip.");
    } finally {
      setJoiningLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }
    await deleteExpense(id);
    setDeleteConfirm(null);
  };

  /* Loading */
  if (loading) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-float">✈️</div>
          <p className="text-muted font-medium">Loading your trip…</p>
        </div>
      </div>
    );
  }

  /* Error */
  if (error || !trip) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🗺️</div>
          <h2 className="font-display text-2xl font-semibold text-night mb-2">
            Trip Not Found
          </h2>
          <p className="text-muted mb-6">
            {error ?? "This trip code doesn't exist or has been deleted."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="btn-press px-6 py-3 rounded-xl bg-ocean text-white font-semibold hover:bg-ocean-dark transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const visibleExpenses = expenses.filter(
    (e) => !e.isPrivate || e.createdBy === currentMemberId,
  );
  const totalSpent = visibleExpenses
    .filter((e) => !e.isSettlement)
    .reduce((s, e) => s + e.amount, 0);
  const categoryTotals = getCategoryTotals(visibleExpenses);
  const memberIndex = Object.fromEntries(trip.members.map((m, i) => [m.id, i]));

  return (
    <div
      className="min-h-screen bg-sand pb-24 flex flex-col"
      style={{ marginTop: "calc(-1 * env(safe-area-inset-top, 0px))" }}
    >
      {/* ── Sticky Header ─────────────────────────── */}
      <header className="sticky top-0 z-40 bg-ocean-dark text-white shadow-lg">
        {/* Fills the camera/notch area with the header colour */}
        <div style={{ height: "env(safe-area-inset-top, 0px)" }} aria-hidden />
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-full hover:bg-white/15 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-semibold leading-tight truncate">
              {trip.name}
            </h1>
            <div className="flex items-center gap-1 text-white/65 text-xs">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{trip.destination}</span>
            </div>
          </div>

          {/* Member avatars */}
          <div className="flex items-center shrink-0">
            <div className="flex -space-x-2">
              {trip.members.slice(0, 4).map((m, i) => (
                <div
                  key={m.id}
                  title={m.name}
                  className="w-7 h-7 rounded-full border-2 border-ocean-dark text-white text-[10px] font-bold flex items-center justify-center"
                  style={{ backgroundColor: getMemberColor(i) }}
                >
                  {getMemberInitials(m.name)}
                </div>
              ))}
              {trip.members.length > 4 && (
                <div className="w-7 h-7 rounded-full border-2 border-ocean-dark bg-white/20 text-white text-[10px] font-bold flex items-center justify-center">
                  +{trip.members.length - 4}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowShare(true)}
              className="ml-3 p-2 rounded-full hover:bg-white/15 transition-colors"
              title="Share trip"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sync indicator */}
        <div
          className={`flex items-center justify-center gap-1.5 py-1 px-2 text-[10px] font-medium ${usingFirebase ? "bg-forest/30 text-white/80" : "bg-gold/20 text-gold"}`}
        >
          {usingFirebase ? (
            <>
              <Wifi className="w-3 h-3 shrink-0" />
              <span className="truncate">Live sync enabled</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 shrink-0" />
              <span className="truncate">
                Local mode — changes save to this device only
              </span>
            </>
          )}
        </div>
      </header>

      <PullToRefresh
        onRefresh={async () => {
          if (usingFirebase) {
            window.location.reload();
          } else {
            window.location.reload();
          }
        }}
      >
        <div className="max-w-3xl mx-auto px-4 pt-5 space-y-4">
          {/* Budget card */}
          <div className="animate-slide-up">
            <BudgetCard
              totalBudget={trip.totalBudget}
              totalSpent={totalSpent}
              currency={trip.currency}
              members={trip.members}
              expenses={visibleExpenses}
              onEdit={updateBudget}
            />
          </div>

          {/* Category + Members side by side on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="animate-slide-up delay-75">
              <CategoryCard
                totalSpent={totalSpent}
                totals={categoryTotals}
                currency={trip.currency}
              />
            </div>
            <div className="animate-slide-up delay-150">
              <MembersCard
                members={trip.members}
                expenses={visibleExpenses}
                currency={trip.currency}
                onAddMember={() => setShowAddMember(true)}
              />
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex rounded-2xl bg-white border border-warmgray overflow-hidden shadow-sm animate-slide-up delay-225">
            {(
              [
                {
                  key: "expenses",
                  label: "Expenses",
                  Icon: ReceiptText,
                  count: visibleExpenses.length,
                },
                {
                  key: "balances",
                  label: "Balances",
                  Icon: Scale,
                  count: trip.members.length,
                },
              ] as const
            ).map(({ key, label, Icon, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
                  activeTab === key
                    ? "bg-ocean text-white"
                    : "text-muted hover:bg-sand"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === key
                      ? "bg-white/20 text-white"
                      : "bg-sand text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* ── Expenses tab ─────────────────────────── */}
          {activeTab === "expenses" && (
            <div className="animate-fade-in">
              {visibleExpenses.length === 0 ? (
                <div className="bg-white rounded-2xl border border-warmgray shadow-sm px-6 py-12 text-center">
                  <div className="text-5xl mb-3 animate-float">🧳</div>
                  <p className="font-semibold text-night mb-1">
                    No expenses yet
                  </p>
                  <p className="text-sm text-muted">
                    Tap the + button to log your first expense.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleExpenses.map((exp, i) => {
                    const isEveryonePaid = exp.paidBy === "ALL";
                    const payerIdx = isEveryonePaid
                      ? 0
                      : (memberIndex[exp.paidBy] ?? 0);
                    const payer = isEveryonePaid
                      ? null
                      : trip.members.find((m) => m.id === exp.paidBy);
                    const myShare = exp.splits.find(
                      (s) => s.memberId === currentMemberId,
                    );

                    return (
                      <div
                        key={exp.id}
                        className="expense-card bg-white rounded-2xl border border-warmgray shadow-sm px-4 sm:px-5 py-4 animate-slide-up"
                        style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Category emoji */}
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5"
                            style={{
                              backgroundColor: `${CATEGORY_COLORS[exp.category]}18`,
                            }}
                          >
                            {CATEGORY_EMOJIS[exp.category]}
                          </div>

                          {/* Main content stack */}
                          <div className="flex-1 min-w-0">
                            {/* Row 1: Description + Amount */}
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-night text-sm leading-tight">
                                {exp.description}
                              </p>
                              <p className="font-bold text-night text-base shrink-0">
                                {formatAmount(exp.amount, trip.currency)}
                              </p>
                            </div>

                            {/* Row 2: Category + badges (single line) */}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white leading-none"
                                style={{
                                  backgroundColor:
                                    CATEGORY_COLORS[exp.category],
                                }}
                              >
                                {CATEGORY_LABELS[exp.category]}
                              </span>
                              {exp.isPrivate && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/20 text-muted leading-none">
                                  🔒 Private
                                </span>
                              )}
                              {exp.isSettlement && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-forest/15 text-forest leading-none">
                                  💸 Settlement
                                </span>
                              )}
                            </div>

                            {/* Row 3: Paid by + Date */}
                            <div className="flex items-center gap-2 mt-1.5">
                              {isEveryonePaid ? (
                                <span className="text-[11px] font-medium text-forest">
                                  👥 Everyone paid
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center shrink-0"
                                    style={{
                                      backgroundColor: getMemberColor(payerIdx),
                                    }}
                                  >
                                    {getMemberInitials(payer?.name ?? "?")}
                                  </div>
                                  <span className="text-[11px] text-muted">
                                    {payer?.name ?? "Unknown"} paid
                                  </span>
                                </div>
                              )}
                              <span className="text-warmgray">·</span>
                              <span className="text-[11px] text-muted">
                                {formatDate(exp.date)}
                              </span>
                            </div>

                            {/* Row 4: Splits */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {exp.splits.map((split) => {
                                const member = trip.members.find(
                                  (m) => m.id === split.memberId,
                                );
                                const isMe = split.memberId === currentMemberId;
                                return (
                                  <span
                                    key={split.memberId}
                                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                      isMe
                                        ? "border-ocean/30 bg-ocean/8 text-ocean"
                                        : "border-warmgray bg-sand text-muted"
                                    }`}
                                  >
                                    {member?.name ?? "Unknown"}:{" "}
                                    {formatAmount(split.amount, trip.currency)}
                                  </span>
                                );
                              })}
                            </div>

                            {/* Row 5: Your share */}
                            {myShare &&
                              !isEveryonePaid &&
                              exp.paidBy !== currentMemberId && (
                                <p className="text-[10px] text-muted mt-1.5 italic">
                                  Your share:{" "}
                                  {formatAmount(myShare.amount, trip.currency)}
                                </p>
                              )}
                          </div>

                          {/* Action buttons — grouped tightly */}
                          <div className="flex items-center gap-1 shrink-0 mt-0.5">
                            <button
                              onClick={() => setEditingExpense(exp)}
                              className="p-1.5 rounded-lg transition-colors text-muted hover:bg-sand hover:text-ocean"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                deleteConfirm === exp.id
                                  ? "bg-coral text-white"
                                  : "text-muted hover:bg-sand hover:text-coral"
                              }`}
                              title={
                                deleteConfirm === exp.id
                                  ? "Tap again to confirm"
                                  : "Delete"
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Balances tab ─────────────────────────── */}
          {activeTab === "balances" && (
            <div className="animate-fade-in">
              <BalanceSheet
                trip={trip}
                expenses={visibleExpenses}
                onRecordSettlement={async ({ from, to, amount }) => {
                  const fromMember = trip.members.find((m) => m.id === from);
                  const toMember = trip.members.find((m) => m.id === to);
                  if (!fromMember || !toMember) return;
                  await addExpense({
                    description: `💸 Settlement to ${toMember.name}`,
                    amount,
                    category: "other",
                    paidBy: from,
                    date: todayISO(),
                    splits: [{ memberId: to, amount }],
                    createdBy: currentMemberId ?? "",
                    isPrivate: false,
                    isSettlement: true,
                  });
                }}
              />
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* ── Floating action button ─────────────────── */}
      {currentMemberId && (
        <button
          onClick={() => setShowAddExpense(true)}
          className="btn-press fixed bottom-6 right-4 sm:right-6 flex items-center gap-2 px-5 py-3.5 rounded-full bg-sunset text-white font-semibold shadow-xl hover:bg-sunset-light transition-colors z-30"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Add Expense</span>
          <span className="sm:hidden">Add</span>
        </button>
      )}

      {/* ── Notification toast ───────────────────── */}
      {toast && (
        <button
          onClick={() => {
            setToast(null);
            setShowChat(true);
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 bg-night text-white text-sm px-4 py-3 rounded-2xl shadow-xl animate-slide-down max-w-xs w-[90vw]"
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          <MessageCircle className="w-4 h-4 shrink-0 text-ocean" />
          <div className="flex-1 min-w-0 text-left">
            <p className="font-semibold text-xs leading-none">{toast.name}</p>
            <p className="text-xs text-white/70 mt-0.5 truncate">
              {toast.text}
            </p>
          </div>
        </button>
      )}

      {/* ── Chat floating button ────────────────────── */}
      <div className="fixed bottom-6 left-4 sm:left-6 z-30">
        <button
          onClick={() => setShowChat(true)}
          className="btn-press relative w-14 h-14 rounded-full bg-ocean text-white flex items-center justify-center shadow-xl hover:bg-ocean/90 transition-colors"
        >
          <MessageCircle className="w-6 h-6" />
          {messages.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-sunset text-white text-[10px] font-bold flex items-center justify-center">
              {messages.length > 99 ? "99+" : messages.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Modals ─────────────────────────────────── */}

      {showChat && (
        <ChatPanel
          messages={messages}
          trip={trip}
          currentMemberId={currentMemberId}
          onClose={() => setShowChat(false)}
          onSend={async (text) => {
            const member = trip.members.find((m) => m.id === currentMemberId);
            if (!member) return;
            await sendMessage(text, member.id, member.name);
          }}
        />
      )}

      {(showAddExpense || editingExpense) && currentMemberId && (
        <AddExpenseModal
          isOpen={showAddExpense || !!editingExpense}
          onClose={() => {
            setShowAddExpense(false);
            setEditingExpense(null);
          }}
          trip={trip}
          currentMemberId={currentMemberId}
          onAdd={addExpense}
          onEdit={updateExpense}
          expense={editingExpense}
        />
      )}

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        tripCode={tripCode}
        tripName={trip.name}
      />

      {/* Add member modal */}
      {showAddMember && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 modal-backdrop animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddMember(false);
          }}
        >
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up p-6">
            <h2 className="font-display text-xl font-semibold text-night mb-4">
              Add Member
            </h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              <input
                type="text"
                placeholder="Member name"
                value={newMemberName}
                autoFocus
                onChange={(e) => setNewMemberName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-warmgray text-night placeholder-muted/60 focus:outline-none focus:border-ocean transition-colors"
              />
              {memberError && (
                <p className="text-sm text-coral">{memberError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="flex-1 py-3 rounded-xl font-semibold text-muted border-2 border-warmgray hover:bg-sand transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="btn-press flex-1 py-3 rounded-xl font-semibold text-white bg-ocean hover:bg-ocean-dark transition-colors disabled:opacity-60"
                >
                  {addingMember ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join trip modal (when visiting URL without membership) */}
      {showJoin && trip && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 modal-backdrop animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-warmgray bg-linear-to-br from-ocean-dark to-ocean text-white">
              <p className="text-xs uppercase tracking-wider opacity-75 mb-0.5 font-medium">
                You&apos;re invited to
              </p>
              <h2 className="font-display text-xl font-semibold">
                {trip.name}
              </h2>
              <p className="text-sm opacity-75 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" /> {trip.destination}
              </p>
            </div>
            <form onSubmit={handleJoinAsNew} className="px-6 py-5 space-y-4">
              {trip.members.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                    Are you one of these members?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {trip.members.map((m, i) => {
                      const color = getMemberColor(i);
                      const selected = joinExistingId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setJoinExistingId(selected ? "" : m.id);
                            setJoinName("");
                          }}
                          className="btn-press flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all text-sm font-medium"
                          style={{
                            borderColor: selected ? color : "#E2D8CA",
                            backgroundColor: selected ? `${color}18` : "white",
                            color: selected ? color : "#1A1F36",
                          }}
                        >
                          <span
                            className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                            style={{ backgroundColor: color }}
                          >
                            {getMemberInitials(m.name)}
                          </span>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-warmgray" />
                <span className="text-xs text-muted">
                  or join as new member
                </span>
                <div className="h-px flex-1 bg-warmgray" />
              </div>

              <input
                type="text"
                placeholder="Your name"
                value={joinName}
                onChange={(e) => {
                  setJoinName(e.target.value);
                  setJoinExistingId("");
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-warmgray text-night placeholder-muted/60 focus:outline-none focus:border-ocean transition-colors"
              />

              {joinError && <p className="text-sm text-coral">{joinError}</p>}

              <button
                type="submit"
                disabled={joiningLoading}
                className="btn-press w-full py-3.5 rounded-xl font-semibold text-white bg-ocean hover:bg-ocean-dark transition-colors disabled:opacity-60"
              >
                {joiningLoading ? "Joining…" : "Join Trip 🗺️"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full py-2 text-sm text-muted hover:text-night transition-colors"
              >
                Go back home
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
