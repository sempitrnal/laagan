export type Category =
  | "lodging"
  | "food"
  | "transport"
  | "activities"
  | "shopping"
  | "other";

export interface Member {
  id: string;
  name: string;
}

export interface Split {
  memberId: string;
  amount: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: Category;
  paidBy: string | "ALL";
  date: string;
  splits: Split[];
  createdAt: number;
  createdBy: string;
  isPrivate?: boolean;
  isSettlement?: boolean;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  currency: string;
  totalBudget: number;
  members: Member[];
  createdAt: number;
}

export interface Balance {
  memberId: string;
  memberName: string;
  paid: number;
  owes: number;
  net: number;
}

export interface Settlement {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: number;
}

export interface RecentTrip {
  code: string;
  name: string;
  destination: string;
  lastAccessed: number;
}
