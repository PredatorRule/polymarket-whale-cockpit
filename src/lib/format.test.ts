// src/lib/format.test.ts
import { describe, it, expect } from "vitest";
import {
  formatCompactUsd,
  formatSignedUsd,
  formatPercent,
  formatSignedPercent,
  truncateAddress,
  formatCents,
  formatLastSeen,
  pnlColor,
} from "./format";

describe("formatCompactUsd", () => {
  it("formats billions", () => {
    expect(formatCompactUsd(1_854_632_179)).toBe("$1.85B");
    expect(formatCompactUsd(1_209_400_000)).toBe("$1.21B");
  });
  it("formats millions (2 decimals under $10M, 1 above)", () => {
    expect(formatCompactUsd(4_200_000)).toBe("$4.20M");
    expect(formatCompactUsd(42_000_000)).toBe("$42.0M");
    expect(formatCompactUsd(310_000)).toBe("$310K");
  });
  it("formats thousands and small values", () => {
    expect(formatCompactUsd(5_282)).toBe("$5.3K");
    expect(formatCompactUsd(640)).toBe("$640");
  });
  it("is sign-aware", () => {
    expect(formatCompactUsd(-2_500_000)).toBe("-$2.50M");
    expect(formatCompactUsd(-15_000_000)).toBe("-$15.0M");
  });
});

describe("formatSignedUsd", () => {
  it("prefixes + for positive and - for negative", () => {
    expect(formatSignedUsd(1_240_500)).toBe("+$1,240,500");
    expect(formatSignedUsd(-42_100)).toBe("-$42,100");
    expect(formatSignedUsd(0)).toBe("$0");
  });
});

describe("percent formatters", () => {
  it("formatPercent", () => {
    expect(formatPercent(78.4)).toBe("78.4%");
  });
  it("formatSignedPercent", () => {
    expect(formatSignedPercent(42.5)).toBe("+42.5%");
    expect(formatSignedPercent(-12.1)).toBe("-12.1%");
  });
});

describe("truncateAddress", () => {
  it("shortens a 0x address", () => {
    expect(truncateAddress("0x204f72f35326db932158cba6adff0b9a1da95e14")).toBe("0x204f…5e14");
  });
  it("leaves short strings untouched", () => {
    expect(truncateAddress("0x1234")).toBe("0x1234");
  });
});

describe("formatCents", () => {
  it("renders a 0..1 price as cents", () => {
    expect(formatCents(0.62)).toBe("62¢");
    expect(formatCents(0.055)).toBe("6¢");
  });
});

describe("formatLastSeen", () => {
  it("returns a dash for missing timestamps", () => {
    expect(formatLastSeen(0)).toBe("\u2014");
    expect(formatLastSeen(-1)).toBe("\u2014");
  });
  it("formats a real timestamp to a date+time string", () => {
    const out = formatLastSeen(1_760_000_000);
    expect(out).not.toBe("\u2014");
    expect(out.length).toBeGreaterThan(4);
  });
});

describe("pnlColor", () => {
  it("maps sign to tailwind classes", () => {
    expect(pnlColor(10)).toContain("emerald");
    expect(pnlColor(-10)).toContain("rose");
    expect(pnlColor(0)).toContain("zinc");
  });
});
