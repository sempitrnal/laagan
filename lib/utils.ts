import type { Category, Member, Expense, Balance, Settlement } from "./types";

export const CATEGORIES: Category[] = [
  "lodging",
  "food",
  "transport",
  "activities",
  "shopping",
  "other",
];

export const CATEGORY_COLORS: Record<Category, string> = {
  lodging: "#6366F1",
  food: "#F97316",
  transport: "#10B981",
  activities: "#8B5CF6",
  shopping: "#EC4899",
  other: "#94A3B8",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  lodging: "Lodging",
  food: "Food & Drink",
  transport: "Transport",
  activities: "Activities",
  shopping: "Shopping",
  other: "Other",
};

export const CATEGORY_EMOJIS: Record<Category, string> = {
  lodging: "🏨",
  food: "🍽️",
  transport: "✈️",
  activities: "🎯",
  shopping: "🛍️",
  other: "📦",
};

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
];

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatAmount(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function generateTripCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function calculateBalances(
  members: Member[],
  expenses: Expense[],
): Balance[] {
  const paid: Record<string, number> = {};
  const owes: Record<string, number> = {};

  members.forEach((m) => {
    paid[m.id] = 0;
    owes[m.id] = 0;
  });

  expenses.forEach((expense) => {
    if (expense.paidBy === "ALL") {
      const share = expense.amount / expense.splits.length;
      expense.splits.forEach((split) => {
        paid[split.memberId] = (paid[split.memberId] ?? 0) + share;
      });
    } else {
      paid[expense.paidBy] = (paid[expense.paidBy] ?? 0) + expense.amount;
    }
    expense.splits.forEach((split) => {
      owes[split.memberId] = (owes[split.memberId] ?? 0) + split.amount;
    });
  });

  return members.map((m) => ({
    memberId: m.id,
    memberName: m.name,
    paid: paid[m.id] ?? 0,
    owes: owes[m.id] ?? 0,
    net: (paid[m.id] ?? 0) - (owes[m.id] ?? 0),
  }));
}

export function calculateSettlements(balances: Balance[]): Settlement[] {
  const settlements: Settlement[] = [];
  const creditors = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ id: b.memberId, name: b.memberName, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ id: b.memberId, name: b.memberName, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debt = debtors[j];
    const amount = Math.min(credit.amount, debt.amount);
    if (amount > 0.005) {
      settlements.push({
        from: debt.id,
        fromName: debt.name,
        to: credit.id,
        toName: credit.name,
        amount: Math.round(amount * 100) / 100,
      });
    }
    credit.amount -= amount;
    debt.amount -= amount;
    if (credit.amount < 0.005) i++;
    if (debt.amount < 0.005) j++;
  }
  return settlements;
}

export function getCategoryTotals(
  expenses: Expense[],
): Record<Category, number> {
  const totals: Record<Category, number> = {
    lodging: 0,
    food: 0,
    transport: 0,
    activities: 0,
    shopping: 0,
    other: 0,
  };
  expenses
    .filter((e) => !e.isSettlement)
    .forEach((e) => {
      totals[e.category] = (totals[e.category] ?? 0) + e.amount;
    });
  return totals;
}

export function getMemberInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const MEMBER_COLORS = [
  "#6366F1",
  "#F97316",
  "#10B981",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#84CC16",
];

export function getMemberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
