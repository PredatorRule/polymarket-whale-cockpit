// src/lib/format.ts
// Clean formatters for currency, addresses, percentages, and timestamps.

/** Compact currency: $1.85B, $4.2M, $310K, $1,240. Sign-aware. */
export function formatCompactUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Full currency with sign and thousands separators: +$1,240,500 / -$42,100. */
export function formatSignedUsd(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Plain currency, no sign forcing: $102.75. */
export function formatUsd(value: number, fractionDigits = 0): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Percentage: 78.4%. */
export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

/** Signed percentage: +42.5% / -12.1%. */
export function formatSignedPercent(value: number, fractionDigits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

/** Truncate a 0x address: 0x8a3f...3f91. */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Contract price in cents from a 0..1 dollar price: 0.42 -> "42¢". */
export function formatCents(price: number): string {
  return `${Math.round(price * 100)}¢`;
}

/**
 * Last-seen from a unix-seconds timestamp: shows the date + time of the last
 * trade (e.g. "Sep 12, 14:32"), or "—" when unknown. Recent trades within the
 * last day include a relative hint via the cell's title attribute upstream.
 */
export function formatLastSeen(tsSeconds: number): string {
  if (!tsSeconds || tsSeconds <= 0) return "\u2014";
  const d = new Date(tsSeconds * 1000);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Profit factor: gross $ won per $ lost. "∞" when there are no losses. */
export function formatProfitFactor(value: number): string {
  if (!Number.isFinite(value) || value >= 999) return "∞";
  if (value <= 0) return "\u2014";
  return `${value.toFixed(2)}×`;
}

/** Tailwind text color class for a PnL value. */
export function pnlColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-zinc-400";
}
