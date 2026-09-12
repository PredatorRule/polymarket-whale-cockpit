// services/whale-alerts/test/format.test.ts
import { describe, it, expect } from "vitest";
import {
  maskAddress,
  formatUsd,
  formatPrice,
  normalizeTrade,
  formatAlert,
  escapeMarkdown,
} from "../src/format";
import type { RawTrade } from "../src/types";

describe("formatters", () => {
  it("masks addresses as 0x204f...5e14", () => {
    expect(maskAddress("0x204f72f353aabbccddeeff00112233445566" + "5e14")).toBe("0x204f...5e14");
  });
  it("formats USD with separators, no decimals", () => {
    expect(formatUsd(150000)).toBe("$150,000");
    expect(formatUsd(1854632179)).toBe("$1,854,632,179");
  });
  it("formats price as dollars and cents", () => {
    expect(formatPrice(0.62)).toBe("$0.62 (62\u00a2)");
  });
  it("escapes markdown reserved chars", () => {
    expect(escapeMarkdown("Fed *rate* _cut_")).toBe("Fed \\*rate\\* \\_cut\\_");
  });
});

describe("normalizeTrade", () => {
  const base: RawTrade = {
    transactionHash: "0xABC",
    proxyWallet: "0x204F72F353AABBCCDDEEFF001122334455665E14",
    title: "Fed cuts rates in Jan",
    eventSlug: "fed-cuts-rates-jan",
    outcome: "yes",
    side: "BUY",
    price: 0.62,
    size: 100000,
    timestamp: 1_760_000_000,
  };

  it("builds a BOUGHT YES action with correct notional", () => {
    const t = normalizeTrade(base);
    expect(t).not.toBeNull();
    expect(t?.action).toBe("BOUGHT YES");
    expect(t?.notionalUsd).toBeCloseTo(62000, 6);
    expect(t?.wallet).toBe("0x204f72f353aabbccddeeff001122334455665e14");
    expect(t?.eventUrl).toBe("https://polymarket.com/event/fed-cuts-rates-jan");
  });
  it("labels SELL NO", () => {
    const t = normalizeTrade({ ...base, side: "SELL", outcome: "NO" });
    expect(t?.action).toBe("SOLD NO");
  });
  it("rejects zero-size or zero-price trades", () => {
    expect(normalizeTrade({ ...base, size: 0 })).toBeNull();
    expect(normalizeTrade({ ...base, price: 0 })).toBeNull();
  });
  it("produces a stable dedupe id", () => {
    const a = normalizeTrade(base);
    const b = normalizeTrade(base);
    expect(a?.id).toBe(b?.id);
  });
});

describe("formatAlert", () => {
  it("contains the header, masked trader, action, size, and market link", () => {
    const t = normalizeTrade({
      transactionHash: "0xabc",
      proxyWallet: "0x204f72f353aabbccddeeff001122334455665e14",
      title: "US Recession 2026",
      eventSlug: "us-recession-2026",
      outcome: "NO",
      side: "BUY",
      price: 0.62,
      size: 100000,
      timestamp: 1_760_000_000,
    });
    const msg = formatAlert(t!);
    expect(msg).toContain("\ud83d\udea8 *WHALE MOVEMENT DETECTED*");
    expect(msg).toContain("0x204f...5e14");
    expect(msg).toContain("BOUGHT NO");
    expect(msg).toContain("$62,000");
    expect(msg).toContain("$0.62 (62\u00a2)");
    expect(msg).toContain("https://polymarket.com/event/us-recession-2026");
  });
});
