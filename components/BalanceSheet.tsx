"use client";
import { ArrowRight, HandCoins, Receipt, Scale, Check } from "lucide-react";
import type { Trip, Expense } from "@/lib/types";
import {
  calculateBalances,
  calculateSettlements,
  formatAmount,
  getMemberInitials,
  getMemberColor,
} from "@/lib/utils";

interface Props {
  trip: Trip;
  expenses: Expense[];
  onRecordSettlement?: (settlement: {
    from: string;
    to: string;
    amount: number;
  }) => void;
}

export default function BalanceSheet({
  trip,
  expenses,
  onRecordSettlement,
}: Props) {
  const balances = calculateBalances(trip.members, expenses);
  const settlements = calculateSettlements(balances);
  const memberIndex = Object.fromEntries(trip.members.map((m, i) => [m.id, i]));

  return (
    <div className="space-y-4">
      {/* ── Explanation banner ───────────────────── */}
      <div className="bg-ocean/5 border border-ocean/20 rounded-2xl px-5 py-3">
        <p className="text-[11px] sm:text-xs text-ocean-dark leading-relaxed">
          <strong>How it works:</strong> &quot;Out of Pocket&quot; is what
          someone actually paid. &quot;Your Cost&quot; is their fair share of
          the trip. If they paid more than their cost, they get money back. If
          less, they owe.
        </p>
      </div>

      {/* ── Member Balances ────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-warmgray overflow-hidden">
        <div className="px-5 py-4 border-b border-warmgray">
          <h3 className="font-semibold text-night">Balances</h3>
        </div>
        <div className="divide-y divide-warmgray">
          {balances.map((b) => {
            const idx = memberIndex[b.memberId] ?? 0;
            const color = getMemberColor(idx);
            const isSettled = Math.abs(b.net) < 0.01;
            const isOwed = b.net > 0.01;

            return (
              <div key={b.memberId} className="px-5 py-4 animate-slide-up">
                {/* Row 1: Avatar + Name + Net badge */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {getMemberInitials(b.memberName)}
                  </div>
                  <p className="font-semibold text-night text-sm flex-1">
                    {b.memberName}
                  </p>

                  {/* Net badge */}
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                      isSettled
                        ? "bg-muted/10 text-muted"
                        : isOwed
                          ? "bg-forest/10 text-forest"
                          : "bg-coral/10 text-coral"
                    }`}
                  >
                    {isSettled
                      ? "Even"
                      : isOwed
                        ? `Gets back ${formatAmount(b.net, trip.currency)}`
                        : `Owes ${formatAmount(Math.abs(b.net), trip.currency)}`}
                  </div>
                </div>

                {/* Row 2: Paid / Share / Net mini cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-sand rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <HandCoins className="w-3 h-3 text-ocean" />
                      <span className="text-[10px] font-semibold text-muted lowercase tracking-wide">
                        outta Pocket
                      </span>
                    </div>
                    <p className="text-sm font-bold text-night">
                      {formatAmount(b.paid, trip.currency)}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">
                      actually paid
                    </p>
                  </div>

                  <div className="bg-sand rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Receipt className="w-3 h-3 text-ocean" />
                      <span className="text-[10px] font-semibold text-muted lowercase tracking-wide">
                        Your Cost
                      </span>
                    </div>
                    <p className="text-sm font-bold text-night">
                      {formatAmount(b.owes, trip.currency)}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">fair share</p>
                  </div>

                  <div className="bg-sand rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Scale className="w-3 h-3 text-ocean" />
                      <span className="text-[10px] font-semibold text-muted lowercase tracking-wide">
                        Balance
                      </span>
                    </div>
                    <p
                      className={`text-sm font-bold ${isSettled ? "text-muted" : isOwed ? "text-forest" : "text-coral"}`}
                    >
                      {isSettled
                        ? "—"
                        : isOwed
                          ? `+${formatAmount(b.net, trip.currency)}`
                          : `-${formatAmount(Math.abs(b.net), trip.currency)}`}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {isSettled
                        ? "all good"
                        : isOwed
                          ? "you get back"
                          : "you owe"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Settle-up suggestions ──────────────────── */}
      {settlements.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-warmgray overflow-hidden">
          <div className="px-5 py-4 border-b border-warmgray">
            <h3 className="font-semibold text-night">Settle Up</h3>
            <p className="text-xs text-muted mt-0.5">
              Who pays whom to make everything even
            </p>
          </div>
          <div className="divide-y divide-warmgray">
            {settlements.map((s, i) => {
              const fromIdx = memberIndex[s.from] ?? 0;
              const toIdx = memberIndex[s.to] ?? 0;
              return (
                <div
                  key={i}
                  className="px-4 sm:px-5 py-4 flex items-center gap-2 sm:gap-3 animate-slide-up flex-wrap sm:flex-nowrap"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shrink-0"
                    style={{ backgroundColor: getMemberColor(fromIdx) }}
                  >
                    {getMemberInitials(s.fromName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-coral">
                        {s.fromName}
                      </span>
                      <span className="text-[10px] text-muted font-medium">
                        pays
                      </span>
                      <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted shrink-0" />
                      <span className="text-sm font-semibold text-forest">
                        {s.toName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto sm:ml-0">
                    <div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shrink-0"
                      style={{ backgroundColor: getMemberColor(toIdx) }}
                    >
                      {getMemberInitials(s.toName)}
                    </div>

                    <div
                      className="px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold text-white shrink-0"
                      style={{ backgroundColor: "#E87B2E" }}
                    >
                      {formatAmount(s.amount, trip.currency)}
                    </div>

                    {onRecordSettlement && (
                      <button
                        onClick={() =>
                          onRecordSettlement({
                            from: s.from,
                            to: s.to,
                            amount: s.amount,
                          })
                        }
                        className="btn-press flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-forest text-white text-[11px] sm:text-xs font-semibold hover:bg-forest/80 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        <span className="hidden sm:inline">Mark Paid</span>
                        <span className="sm:hidden">Paid</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {settlements.length === 0 && expenses.length > 0 && (
        <div className="bg-forest/5 border border-forest/20 rounded-2xl px-5 py-4 text-center">
          <p className="text-sm font-medium text-forest">🎉 All settled up!</p>
          <p className="text-xs text-muted mt-0.5">
            Everyone&apos;s paid their fair share.
          </p>
        </div>
      )}
    </div>
  );
}
