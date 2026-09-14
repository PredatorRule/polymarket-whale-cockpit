// services/whale-alerts/test/format.test.ts
import { describe, it, expect } from "vitest";
import {
  maskAddress,
  formatUsd,
  formatPrice,
  normalizeTrade,
  formatAlert,
  escapeHtml,
  sizeTier,
  alertKeyboard,
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
  it("escapes HTML reserved chars", () => {
    expect(escapeHtml("Fed <b>rate</b> & cut")).toBe("Fed &lt;b&gt;rate&lt;/b&gt; &amp; cut");
  });
});

describe("sizeTier", () => {
  it("tiers by notional", () => {
    expect(sizeTier(150_000).label).toBe("MEGA WHALE");
    expect(sizeTier(30_000).label).toBe("WHALE");
    expect(sizeTier(6_000).label).toBe("BIG TRADE");
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
  })!;

  it("contains tier, action, size, price, and masked trader (HTML)", () => {
    const msg = formatAlert(t);
    expect(msg).toContain("WHALE"); // $62k -> WHALE tier
    expect(msg).toContain("BOUGHT NO");
    expect(msg).toContain("$62,000");
    expect(msg).toContain("$0.62 (62\u00a2)");
    expect(msg).toContain("0x204f...5e14");
    // HTML, not Markdown, so uses <b> and <a href>.
    expect(msg).toContain("<b>");
    expect(msg).toContain('<a href="https://polymarket.com/profile/');
  });

  it("HTML-escapes the market title", () => {
    const evil = normalizeTrade({
      transactionHash: "0xdef",
      proxyWallet: "0x204f72f353aabbccddeeff001122334455665e14",
      title: "A <script> & B",
      eventSlug: "x",
      outcome: "YES",
      side: "BUY",
      price: 0.5,
      size: 20000,
      timestamp: 1_760_000_100,
    })!;
    const msg = formatAlert(evil);
    expect(msg).toContain("A &lt;script&gt; &amp; B");
    expect(msg).not.toContain("<script>");
  });
});

describe("alertKeyboard", () => {
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
  })!;

  it("builds market + audit-wallet buttons, trailing slash tolerant", () => {
    const kb = alertKeyboard(t, "https://example.dev/");
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0][0].url).toBe("https://polymarket.com/event/us-recession-2026");
    expect(kb.inline_keyboard[1][0].url).toBe(
      "https://example.dev/wallet/0x204f72f353aabbccddeeff001122334455665e14",
    );
  });
});
