import { describe, expect, it } from "vitest";

import { formatAvg, formatRate } from "./format";

describe("formatAvg", () => {
  it("drops the leading zero, NPB-style", () => {
    expect(formatAvg(0.417)).toBe(".417");
    expect(formatAvg(0.4375)).toBe(".438"); // rounds to 3 decimals
  });
  it("formats zero as .000", () => {
    expect(formatAvg(0)).toBe(".000");
  });
  it("formats 1.000 without dropping the leading digit", () => {
    expect(formatAvg(1)).toBe("1.000");
  });
  it("preserves a leading minus sign for negative values", () => {
    expect(formatAvg(-0.05)).toBe("-.050");
  });
  it("falls back to .000 for non-finite input (NaN/Infinity)", () => {
    expect(formatAvg(NaN)).toBe(".000");
    expect(formatAvg(Infinity)).toBe(".000");
  });
});

describe("formatRate", () => {
  it("formats to 2 decimal places", () => {
    expect(formatRate(6.5)).toBe("6.50");
    expect(formatRate(0)).toBe("0.00");
  });
  it("falls back to 0.00 for non-finite input", () => {
    expect(formatRate(NaN)).toBe("0.00");
    expect(formatRate(Infinity)).toBe("0.00");
  });
});
