"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Hash,
  Clock,
  MapPin,
  ChevronRight,
  Compass,
  X,
} from "lucide-react";
import {
  createTrip,
  checkTripExists,
  addMemberToTrip,
} from "@/lib/tripService";
import { CURRENCIES, getMemberColor, getMemberInitials } from "@/lib/utils";
import type { RecentTrip, Trip } from "@/lib/types";
import { isFirebaseConfigured } from "@/lib/firebase";

type Modal = "none" | "create" | "join";
type CreateStep = 1 | 2;

function StarField() {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: Math.random() * 2.5 + 1,
    delay: Math.random() * 3,
  }));
  return (
    <>
      {stars.map((s) => (
        <span
          key={s.id}
          className="star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function RecentTripCard({ recent }: { recent: RecentTrip }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/trip/${recent.code}`)}
      className="btn-press w-full text-left flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-colors"
    >
      <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
        <MapPin className="w-4 h-4 text-white/80" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {recent.name}
        </p>
        <p className="text-xs text-white/60 truncate">{recent.destination}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/50 shrink-0" />
    </button>
  );
}

export default function LandingScreen() {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>("none");
  const [createStep, setCreateStep] = useState<CreateStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);

  // Create form
  const [tripName, setTripName] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [budget, setBudget] = useState("");
  const [creatorName, setCreatorName] = useState("");

  // Join form
  const [joinCode, setJoinCode] = useState("");
  const [foundTrip, setFoundTrip] = useState<Trip | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinExistingId, setJoinExistingId] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("wt_recent_trips");
    if (raw) {
      const all: RecentTrip[] = JSON.parse(raw);
      setRecentTrips(
        all.sort((a, b) => b.lastAccessed - a.lastAccessed).slice(0, 3),
      );
    }
  }, []);

  function trackRecent(trip: Trip) {
    const raw = localStorage.getItem("wt_recent_trips");
    const all: RecentTrip[] = raw ? JSON.parse(raw) : [];
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

  const closeModal = () => {
    setModal("none");
    setCreateStep(1);
    setError("");
    setFoundTrip(null);
    setJoinCode("");
    setJoinName("");
    setJoinExistingId("");
  };

  // ── Create Trip ──────────────────────────────────

  const handleCreateStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripName.trim() || !destination.trim()) {
      setError("Please fill in all fields with valid values.");
      return;
    }
    setError("");
    setCreateStep(2);
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorName.trim()) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { tripCode, memberId } = await createTrip(
        {
          name: tripName.trim(),
          destination: destination.trim(),
          currency,
          totalBudget: parseFloat(budget),
        },
        creatorName.trim(),
      );
      localStorage.setItem(`wt_me_${tripCode}`, memberId);
      trackRecent({
        id: tripCode,
        name: tripName.trim(),
        destination: destination.trim(),
        currency,
        totalBudget: parseFloat(budget),
        members: [],
        createdAt: Date.now(),
      });
      router.push(`/trip/${tripCode}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Join Trip ────────────────────────────────────

  const handleLookupTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.toUpperCase().trim();
    if (!code) {
      setError("Please enter a trip code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const trip = await checkTripExists(code);
      if (!trip) {
        setError("Trip not found. Double-check the code and try again.");
      } else {
        setFoundTrip(trip);
        setError("");
      }
    } catch {
      setError("Failed to look up trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundTrip) return;
    if (!joinExistingId && !joinName.trim()) {
      setError("Please enter your name or pick yourself from the list.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const code = foundTrip.id;
      let memberId = joinExistingId;
      if (!joinExistingId) {
        const result = await addMemberToTrip(code, joinName.trim(), foundTrip);
        memberId = result.memberId;
      }
      localStorage.setItem(`wt_me_${code}`, memberId);
      trackRecent(foundTrip);
      router.push(`/trip/${code}`);
    } catch {
      setError("Failed to join trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const memberIndex = Object.fromEntries(
    (foundTrip?.members ?? []).map((m, i) => [m.id, i]),
  );

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      style={{
        background:
          "linear-gradient(135deg, #0D3D5C 0%, #1B5E8A 50%, #2A7BB5 100%)",
      }}
    >
      <StarField />

      {/* Decorative compass */}
      <div className="absolute top-10 right-10 opacity-10 pointer-events-none hidden lg:block">
        <Compass className="w-48 h-48 text-white animate-spin-slow" />
      </div>

      {/* Decorative grid lines (subtle map feel) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Main content */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-16 z-10">
        {/* Logo / Hero */}
        <div className="text-center mb-12 animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-4 animate-float">
            <span className="text-3xl">✈️</span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-bold text-white mb-3 tracking-tight">
            Wandersplit
          </h1>
          <p className="text-white/70 text-base sm:text-lg max-w-sm mx-auto leading-relaxed px-2">
            Track, split & settle travel expenses with your crew — in real time.
          </p>
          {!isFirebaseConfigured && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/20 border border-gold/30 text-gold text-[11px] sm:text-xs font-medium">
              <span>⚡</span>
              <span>Local mode — add Firebase for real-time sync</span>
            </div>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="w-full max-w-sm space-y-3 animate-slide-up delay-150 px-4 sm:px-0">
          <button
            onClick={() => {
              setModal("create");
              setCreateStep(1);
            }}
            className="btn-press w-full flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-2xl bg-sunset text-white font-semibold text-base sm:text-lg shadow-lg hover:bg-sunset-light transition-colors"
          >
            <Plus className="w-5 h-5" />
            Plan a New Trip
          </button>
          <button
            onClick={() => setModal("join")}
            className="btn-press w-full flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-2xl bg-white/15 backdrop-blur text-white font-semibold text-base sm:text-lg border border-white/30 hover:bg-white/25 transition-colors"
          >
            <Hash className="w-5 h-5" />
            Join with Trip Code
          </button>
        </div>

        {/* Recent trips */}
        {recentTrips.length > 0 && (
          <div className="w-full max-w-sm mt-10 animate-slide-up delay-300">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-white/50" />
              <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                Recent Trips
              </span>
            </div>
            <div className="space-y-2">
              {recentTrips.map((r) => (
                <RecentTripCard key={r.code} recent={r} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ═══════════ CREATE TRIP MODAL ═══════════ */}
      {modal === "create" && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 modal-backdrop animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-warmgray">
              <div>
                <h2 className="font-display text-xl font-semibold text-night">
                  {createStep === 1 ? "Plan a New Trip" : "Almost there!"}
                </h2>
                <div className="flex gap-1.5 mt-1.5">
                  {[1, 2].map((s) => (
                    <div
                      key={s}
                      className={`h-1.5 rounded-full transition-all ${s <= createStep ? "bg-ocean w-6" : "bg-warmgray w-3"}`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-sand transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Step 1 */}
            {createStep === 1 && (
              <form
                onSubmit={handleCreateStep1}
                className="px-6 py-5 space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Trip Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Summer in Japan"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-warmgray text-night placeholder-muted/60 focus:outline-none focus:border-ocean transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Destination
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tokyo, Japan"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-warmgray text-night placeholder-muted/60 focus:outline-none focus:border-ocean transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border-2 border-warmgray text-night bg-white focus:outline-none focus:border-ocean transition-colors"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                      Total Budget
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="0.00"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border-2 border-warmgray text-night placeholder-muted/60 focus:outline-none focus:border-ocean transition-colors"
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-coral">{error}</p>}
                <button
                  type="submit"
                  className="btn-press w-full py-3.5 rounded-xl font-semibold text-white bg-ocean hover:bg-ocean-dark transition-colors mt-2"
                >
                  Continue →
                </button>
              </form>
            )}

            {/* Step 2 */}
            {createStep === 2 && (
              <form onSubmit={handleCreateTrip} className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-sand rounded-xl">
                  <MapPin className="w-4 h-4 text-ocean shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-night">
                      {tripName}
                    </p>
                    <p className="text-xs text-muted">
                      {destination} · {budget} {currency}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Chen"
                    value={creatorName}
                    autoFocus
                    onChange={(e) => setCreatorName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-warmgray text-night placeholder-muted/60 focus:outline-none focus:border-ocean transition-colors"
                  />
                  <p className="text-xs text-muted mt-1.5">
                    You&apos;ll be the first member. You can add others later.
                  </p>
                </div>
                {error && <p className="text-sm text-coral">{error}</p>}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-muted border-2 border-warmgray hover:bg-sand transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-press flex-2 py-3.5 rounded-xl font-semibold text-white bg-ocean hover:bg-ocean-dark transition-colors disabled:opacity-60"
                  >
                    {loading ? "Creating…" : "🎉 Create Trip"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ JOIN TRIP MODAL ═══════════ */}
      {modal === "join" && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 modal-backdrop animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-warmgray">
              <h2 className="font-display text-xl font-semibold text-night">
                {foundTrip ? `Join ${foundTrip.name}` : "Join a Trip"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-sand transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {!foundTrip ? (
              /* Step: enter code */
              <form onSubmit={handleLookupTrip} className="px-6 py-5 space-y-4">
                <p className="text-sm text-muted">
                  Enter the 6-character trip code your friend shared with you.
                </p>
                <input
                  type="text"
                  placeholder="e.g. ABC123"
                  value={joinCode}
                  autoFocus
                  maxLength={6}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-4 rounded-xl border-2 border-warmgray text-2xl text-center font-bold tracking-widest text-night placeholder-warmgray focus:outline-none focus:border-ocean transition-colors uppercase"
                />
                {error && <p className="text-sm text-coral">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-press w-full py-3.5 rounded-xl font-semibold text-white bg-ocean hover:bg-ocean-dark transition-colors disabled:opacity-60"
                >
                  {loading ? "Looking up…" : "Find Trip →"}
                </button>
              </form>
            ) : (
              /* Step: who are you? */
              <form onSubmit={handleJoinTrip} className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-sand rounded-xl">
                  <MapPin className="w-4 h-4 text-ocean shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-night">
                      {foundTrip.destination}
                    </p>
                    <p className="text-xs text-muted">
                      {foundTrip.members.length} member
                      {foundTrip.members.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {foundTrip.members.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                      Are you one of these?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {foundTrip.members.map((m) => {
                        const idx = memberIndex[m.id] ?? 0;
                        const color = getMemberColor(idx);
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
                              backgroundColor: selected
                                ? `${color}18`
                                : "white",
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

                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={joinName}
                    onChange={(e) => {
                      setJoinName(e.target.value);
                      setJoinExistingId("");
                    }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-warmgray text-night placeholder-muted/60 focus:outline-none focus:border-ocean transition-colors"
                  />
                </div>

                {error && <p className="text-sm text-coral">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFoundTrip(null);
                      setError("");
                    }}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-muted border-2 border-warmgray hover:bg-sand transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-press flex-2 py-3.5 rounded-xl font-semibold text-white bg-ocean hover:bg-ocean-dark transition-colors disabled:opacity-60"
                  >
                    {loading ? "Joining…" : "Join Trip 🗺️"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
