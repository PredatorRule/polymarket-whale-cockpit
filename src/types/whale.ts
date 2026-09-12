// src/types/whale.ts
// Fully typed domain models for the Polymarket Whale Cockpit.

export type Outcome = "YES" | "NO";

export type WhaleCategory = "Politics" | "Macro" | "Crypto" | "Sports" | "Pop Culture";

export interface WhalePosition {
  id: string;
  marketTitle: string;
  outcome: Outcome;
  shares: number;
  avgPrice: number; // entry price in dollars, 0..1
  currentPrice: number; // current mark, 0..1
  pnl: number; // realized/unrealized dollars (may be negative)
  pnlPercent: number; // percentage, e.g. 42.5 or -12.1
  totalCost: number; // dollars deployed
  category: WhaleCategory;
  timestamp: string; // ISO string
  isLocked: boolean; // gated behind Pro (active alpha)
}

export interface CurrentTopBet {
  marketTitle: string;
  outcome: Outcome;
  amount: number; // dollars
}

export interface WhaleTrader {
  id: string;
  rank: number;
  address: string; // 0x...
  ensName?: string; // e.g. "theo4.eth"
  avatarUrl?: string;
  totalPnl: number; // all-time dollars (may be negative)
  pnl30d: number;
  pnl7d: number;
  winRate: number; // percentage, e.g. 78.4
  wins: number;
  losses: number;
  totalVolume: number; // dollars
  activePositionsCount: number;
  category: WhaleCategory;
  badges: string[];
  lastActive: string; // relative label like "4m ago"
  currentTopBet: CurrentTopBet;
  positions: WhalePosition[];
}

export type TimeHorizon = "all" | "30d" | "7d";

export type CategoryFilter = "All" | WhaleCategory;

export type SortKey =
  | "rank"
  | "totalPnl"
  | "winRate"
  | "totalVolume"
  | "pnl30d"
  | "pnl7d";

export interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}
