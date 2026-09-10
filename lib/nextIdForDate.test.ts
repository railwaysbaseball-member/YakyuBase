import { describe, expect, it } from "vitest";

import { nextIdForDate } from "./nextIdForDate";

describe("nextIdForDate", () => {
  it("generates a plain date-based id when none exists yet", () => {
    expect(nextIdForDate("game", "2026-09-10", [])).toBe("game-20260910");
  });

  it("appends -2 for a second entry on the same date (doubleheader)", () => {
    expect(nextIdForDate("game", "2026-09-10", ["game-20260910"])).toBe("game-20260910-2");
  });

  it("keeps incrementing past existing collisions", () => {
    expect(nextIdForDate("game", "2026-09-10", ["game-20260910", "game-20260910-2"])).toBe(
      "game-20260910-3"
    );
  });

  it("does not collide across different prefixes on the same date", () => {
    expect(nextIdForDate("sched", "2026-09-10", ["game-20260910"])).toBe("sched-20260910");
  });
});
