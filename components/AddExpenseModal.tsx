"use client";
import { useState, useEffect } from "react";
import { X, ChevronDown, Check } from "lucide-react";
import type { Category, Expense, Trip } from "@/lib/types";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  getCurrencySymbol,
  getMemberColor,
  getMemberInitials,
  todayISO,
} from "@/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  currentMemberId: string;
  onAdd: (expense: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  onEdit?: (
    expenseId: string,
    updates: Partial<Omit<Expense, "id" | "createdAt">>,
  ) => Promise<void>;
  expense?: Expense | null;
}

type SplitType = "even" | "custom";

export default function AddExpenseModal({
  isOpen,
  onClose,
  trip,
  currentMemberId,
  onAdd,
  onEdit,
  expense,
}: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [paidBy, setPaidBy] = useState<string | "ALL">("ALL");
  const [date, setDate] = useState(todayISO());
  const [splitType, setSplitType] = useState<SplitType>("even");
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    trip.members.map((m) => m.id),
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {},
  );
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (expense) {
        setDescription(expense.description);
        setAmount(String(expense.amount));
        setCategory(expense.category);
        setPaidBy(expense.paidBy);
        setDate(expense.date);
        const splitIds = expense.splits.map((s) => s.memberId);
        setSelectedMembers(splitIds);
        setCustomAmounts(
          Object.fromEntries(
            expense.splits.map((s) => [s.memberId, String(s.amount)]),
          ),
        );
        setSplitType("custom");
        setIsPrivate(expense.isPrivate ?? false);
      } else {
        setDescription("");
        setAmount("");
        setCategory("other");
        setPaidBy("ALL");
        setDate(todayISO());
        setSplitType("even");
        setSelectedMembers(trip.members.map((m) => m.id));
        setCustomAmounts({});
        setIsPrivate(false);
      }
      setErrors({});
    }
  }, [isOpen, currentMemberId, trip.members, expense]);

  const numericAmount = parseFloat(amount) || 0;
  const symbol = getCurrencySymbol(trip.currency);

  const evenShare =
    selectedMembers.length > 0 ? numericAmount / selectedMembers.length : 0;

  const customTotal = selectedMembers.reduce(
    (s, id) => s + (parseFloat(customAmounts[id] || "0") || 0),
    0,
  );
  const customRemaining = numericAmount - customTotal;

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!description.trim()) e.description = "Please enter a description";
    if (!amount || numericAmount <= 0) e.amount = "Please enter a valid amount";
    if (selectedMembers.length === 0) e.split = "Select at least one person";
    if (splitType === "custom" && Math.abs(customRemaining) > 0.01) {
      e.split = `Custom amounts must add up to ${symbol}${numericAmount.toFixed(2)} (${symbol}${Math.abs(customRemaining).toFixed(2)} ${customRemaining > 0 ? "remaining" : "over"})`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const splits = isPrivate
      ? [{ memberId: currentMemberId, amount: numericAmount }]
      : splitType === "even"
        ? selectedMembers.map((id) => ({
            memberId: id,
            amount: Math.round(evenShare * 100) / 100,
          }))
        : selectedMembers.map((id) => ({
            memberId: id,
            amount: parseFloat(customAmounts[id] || "0") || 0,
          }));

    try {
      if (expense && onEdit) {
        await onEdit(expense.id, {
          description: description.trim(),
          amount: numericAmount,
          category,
          paidBy,
          date,
          splits,
          isPrivate,
        });
      } else {
        await onAdd({
          description: description.trim(),
          amount: numericAmount,
          category,
          paidBy,
          date,
          splits,
          createdBy: currentMemberId,
          isPrivate,
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const memberIndex = Object.fromEntries(trip.members.map((m, i) => [m.id, i]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-warmgray shrink-0">
          <div>
            <h2 className="font-display text-xl font-semibold text-night">
              {expense ? "Edit Expense" : "Add Expense"}
            </h2>
            <p className="text-xs text-muted">
              {trip.name} · {trip.destination}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-sand transition-colors"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-5">
            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                Description
              </label>
              <input
                type="text"
                placeholder="e.g. Dinner at La Maison"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 text-night placeholder-muted/60 transition-colors focus:outline-none focus:border-ocean ${
                  errors.description ? "border-coral" : "border-warmgray"
                }`}
              />
              {errors.description && (
                <p className="text-xs text-coral mt-1">{errors.description}</p>
              )}
            </div>

            {/* Amount + Date row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-medium">
                    {symbol}
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full pl-9 pr-3 py-3 rounded-xl border-2 text-night placeholder-muted/60 transition-colors focus:outline-none focus:border-ocean ${
                      errors.amount ? "border-coral" : "border-warmgray"
                    }`}
                  />
                </div>
                {errors.amount && (
                  <p className="text-xs text-coral mt-1">{errors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border-2 border-warmgray text-night focus:outline-none focus:border-ocean transition-colors"
                />
              </div>
            </div>

            {/* Category pills */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className="btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                      style={{
                        backgroundColor: active
                          ? CATEGORY_COLORS[cat]
                          : "#F4EDE0",
                        color: active ? "white" : "#1A1F36",
                        border: `2px solid ${active ? CATEGORY_COLORS[cat] : "#E2D8CA"}`,
                      }}
                    >
                      <span>{CATEGORY_EMOJIS[cat]}</span>
                      <span>{CATEGORY_LABELS[cat]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paid by */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                Paid By
              </label>
              <div className="relative">
                <select
                  value={paidBy}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPaidBy(val as string | "ALL");
                    if (val === "ALL") setSplitType("even");
                  }}
                  className="w-full appearance-none px-4 py-3 rounded-xl border-2 border-warmgray text-night focus:outline-none focus:border-ocean transition-colors bg-white"
                >
                  {trip.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  <option value="ALL">👥 everyone</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              </div>
            </div>

            {/* Split section — hidden for personal expenses */}
            {!isPrivate && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Split Between
                  </label>
                  {/* Even / Custom toggle */}
                  <div
                    className={`flex rounded-lg border-2 overflow-hidden ${paidBy === "ALL" ? "border-warmgray opacity-50" : "border-warmgray"}`}
                  >
                    {(["even", "custom"] as SplitType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          if (paidBy !== "ALL") setSplitType(t);
                        }}
                        disabled={paidBy === "ALL"}
                        className={`px-3 py-1 text-xs font-semibold transition-colors ${
                          splitType === t
                            ? "bg-ocean text-white"
                            : "bg-white text-muted hover:bg-sand"
                        } ${paidBy === "ALL" ? "cursor-not-allowed" : ""}`}
                      >
                        {t === "even" ? "Evenly" : "Custom"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {trip.members.map((m) => {
                    const idx = memberIndex[m.id] ?? 0;
                    const color = getMemberColor(idx);
                    const checked = selectedMembers.includes(m.id);

                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors cursor-pointer ${
                          checked
                            ? "border-ocean/30 bg-ocean/5"
                            : "border-warmgray bg-white"
                        }`}
                        onClick={() => toggleMember(m.id)}
                      >
                        {/* Avatar */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {getMemberInitials(m.name)}
                        </div>

                        <span className="text-sm font-medium text-night flex-1">
                          {m.name}
                        </span>

                        {/* Checkbox or custom amount */}
                        {splitType === "even" ? (
                          <div className="flex items-center gap-2">
                            {checked && numericAmount > 0 && (
                              <span className="text-xs text-muted font-medium">
                                {symbol}
                                {evenShare.toFixed(2)}
                              </span>
                            )}
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                                checked
                                  ? "bg-ocean border-ocean"
                                  : "border-warmgray"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMember(m.id);
                              }}
                            >
                              {checked && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {checked && (
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">
                                  {symbol}
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={customAmounts[m.id] ?? ""}
                                  onChange={(e) =>
                                    setCustomAmounts((prev) => ({
                                      ...prev,
                                      [m.id]: e.target.value,
                                    }))
                                  }
                                  className="w-24 pl-7 pr-2 py-1.5 rounded-lg border-2 border-warmgray text-sm text-night focus:outline-none focus:border-ocean"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            )}
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors cursor-pointer ${
                                checked
                                  ? "bg-ocean border-ocean"
                                  : "border-warmgray"
                              }`}
                              onClick={() => toggleMember(m.id)}
                            >
                              {checked && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Custom split summary */}
                {splitType === "custom" && numericAmount > 0 && (
                  <div
                    className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${
                      Math.abs(customRemaining) < 0.01
                        ? "bg-forest/10 text-forest"
                        : "bg-coral/10 text-coral"
                    }`}
                  >
                    {Math.abs(customRemaining) < 0.01
                      ? `✓ Amounts add up to ${symbol}${numericAmount.toFixed(2)}`
                      : `${symbol}${Math.abs(customRemaining).toFixed(2)} ${customRemaining > 0 ? "remaining to allocate" : "over allocated"}`}
                  </div>
                )}

                {errors.split && (
                  <p className="text-xs text-coral mt-1">{errors.split}</p>
                )}
              </div>
            )}

            {/* Private expense toggle */}
            <div className="px-6 pb-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-warmgray cursor-pointer hover:bg-sand/50 transition-colors">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 accent-ocean"
                />
                <div>
                  <p className="text-sm font-medium text-night">
                    Personal expense
                  </p>
                  <p className="text-xs text-muted">
                    Only visible to you, won&apos;t affect group balances
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-2 border-t border-warmgray shrink-0 bg-white">
            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full py-3.5 rounded-xl font-semibold text-white bg-ocean hover:bg-ocean-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? "Saving…"
                : `${expense ? "Save Changes" : "Add Expense"}${numericAmount > 0 ? ` · ${symbol}${numericAmount.toFixed(2)}` : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
