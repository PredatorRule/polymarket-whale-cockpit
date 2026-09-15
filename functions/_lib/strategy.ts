// functions/_lib/strategy.ts
// Derives a trading-style archetype + differentiating metrics for a wallet from
// its open positions and realized (closed) PnL. These are things WE compute —
// not raw numbers Polymarket already shows — so they're the Pro edge.

export interface StrategyPosition {
  totalCost: number;
  avgPrice: number; // 0..1 entry price = implied probability paid
  currentPrice: number; // 0..1
  shares: number;
}

export interface StrategyInput {
  positions: StrategyPosition[];
  openValueUsdc: number;
  openPnlUsdc: number; // unrealized cash PnL across open positions
  // Realized PnL, one entry per closed position.
  realizedPnls: number[];
}

export interface WalletStrategy {
  archetype: string; // e.g. "Longshot Hunter"
  tagline: string; // one-line plain-English description of the style
  avgEntryPrice: number; // 0..1, cost-weighted entry across open positions
  profitFactor: number; // gross wins / gross losses (realized); 0 if N/A
  concentrationPct: number; // largest open position as % of open book
  realizedPnl: number;
  openPnl: number;
  avgPositionUsdc: number; // mean deployed cost per open position
}

/**
 * Classify a wallet's style from HOW it deploys capital, not just outcomes:
 *  - avg entry price = conviction proxy (high = backs favorites, low = longshots)
 *  - concentration   = how much of the book sits in one position
 *  - breadth         = number of concurrent positions
 */
export function deriveStrategy(input: StrategyInput): WalletStrategy {
  const { positions, openValueUsdc, openPnlUsdc, realizedPnls } = input;

  // Cost-weighted average entry price (implied probability the wallet paid for).
  const costSum = positions.reduce((a, p) => a + Math.max(p.totalCost, 0), 0);
  const clampPrice = (v: number) => (Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0);
  const avgEntryPrice =
    costSum > 0
      ? positions.reduce((a, p) => a + Math.max(p.totalCost, 0) * clampPrice(p.avgPrice), 0) / costSum
      : 0;

  // Concentration: largest current position value vs the whole open book.
  const posValues = positions.map((p) => Math.max(p.currentPrice * p.shares, 0));
  const topValue = posValues.length ? Math.max(...posValues) : 0;
  const bookValue = openValueUsdc > 0 ? openValueUsdc : posValues.reduce((a, b) => a + b, 0);
  const concentrationPct = bookValue > 0 ? (topValue / bookValue) * 100 : 0;

  // Profit factor from realized trades — a real edge measure.
  const grossWon = realizedPnls.filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const grossLost = Math.abs(realizedPnls.filter((v) => v < 0).reduce((a, b) => a + b, 0));
  // Cap instead of Infinity: JSON.stringify turns Infinity into null. 999 is a
  // clear "no losses" sentinel the client renders as "∞".
  const profitFactor = grossLost > 0 ? grossWon / grossLost : grossWon > 0 ? 999 : 0;

  const realizedPnl = realizedPnls.reduce((a, b) => a + b, 0);
  const breadth = positions.length;
  const avgPositionUsdc = breadth > 0 ? bookValue / breadth : 0;

  const { archetype, tagline } = classify({
    avgEntryPrice,
    concentrationPct,
    breadth,
    profitFactor,
  });

  return {
    archetype,
    tagline,
    avgEntryPrice,
    profitFactor,
    concentrationPct,
    realizedPnl,
    openPnl: openPnlUsdc,
    avgPositionUsdc,
  };
}

function classify(m: {
  avgEntryPrice: number;
  concentrationPct: number;
  breadth: number;
  profitFactor: number;
}): { archetype: string; tagline: string } {
  // No open book to read — fall back to realized edge if we have it.
  if (m.breadth === 0) {
    if (m.profitFactor >= 1.5) return { archetype: "Proven Closer", tagline: "Flat right now, but a strong realized track record." };
    return { archetype: "Currently Flat", tagline: "No open positions to read a live style from." };
  }

  // Big single-position conviction.
  if (m.concentrationPct >= 50 && m.breadth <= 6) {
    return {
      archetype: "Concentrated Directional",
      tagline: "Bets big on a few strong convictions rather than spreading risk.",
    };
  }

  // Wide book, no dominant position — spreads across many markets.
  if (m.breadth >= 15 && m.concentrationPct < 20) {
    return {
      archetype: "Diversified Book",
      tagline: "Runs a broad portfolio across many markets, market-maker style.",
    };
  }

  // Otherwise read conviction from the price they pay to enter.
  if (m.avgEntryPrice >= 0.7) {
    return {
      archetype: "Favorite Backer",
      tagline: "Grinds small edges on likely outcomes — high hit-rate, modest payouts.",
    };
  }
  if (m.avgEntryPrice <= 0.3 && m.avgEntryPrice > 0) {
    return {
      archetype: "Longshot Hunter",
      tagline: "Chases underdogs for outsized payouts — lower hit-rate, big winners.",
    };
  }
  return {
    archetype: "Value Trader",
    tagline: "Hunts mispriced mid-range odds where the crowd is unsure.",
  };
}
