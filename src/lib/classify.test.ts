// src/lib/classify.test.ts
import { describe, it, expect } from "vitest";
import { classifyTitles } from "./classify";

describe("classifyTitles", () => {
  it("detects Sports from soccer/tennis titles", () => {
    expect(classifyTitles(["Will Los Angeles FC win on 2026-09-12?"])).toBe("Sports");
    expect(classifyTitles(["Barranquilla: Claire Liu vs Anna Blinkova"])).toBe("Sports");
  });
  it("detects Crypto", () => {
    expect(classifyTitles(["BTC above $120k on Jan 31"])).toBe("Crypto");
  });
  it("detects Macro", () => {
    expect(classifyTitles(["Will the Fed increase interest rates by 25 bps?"])).toBe("Macro");
  });
  it("detects Politics", () => {
    expect(classifyTitles(["Government shutdown before April"])).toBe("Politics");
  });
  it("detects Pop Culture", () => {
    expect(classifyTitles(["Best Picture winner at the Oscars"])).toBe("Pop Culture");
  });
  it("falls back to Other for unmatched titles", () => {
    expect(classifyTitles(["Something totally ambiguous zzz"])).toBe("Other");
    expect(classifyTitles([])).toBe("Other");
  });
  it("checks Crypto before Sports when both could match", () => {
    // 'match' would hit Sports, but bitcoin should win via Crypto's earlier order.
    expect(classifyTitles(["Bitcoin price match milestone"])).toBe("Crypto");
  });
});
