import { describe, expect, it } from "vitest";
import { intensityBucket, niceCeil, percentChange } from "./chart";

describe("niceCeil", () => {
  it.each([
    [0, 0],
    [7, 10],
    [18, 20],
    [23, 25],
    [1837, 2000],
    [2400, 2500],
    [4100, 5000],
    [10000, 10000],
    [10001, 20000],
  ])("%d → %d", (input, expected) => {
    expect(niceCeil(input)).toBe(expected);
  });
});

describe("intensityBucket", () => {
  it("is 0 for no spending", () => {
    expect(intensityBucket(0, 1000)).toBe(0);
  });
  it("scales against the busiest day", () => {
    expect(intensityBucket(1000, 1000)).toBe(5);
    expect(intensityBucket(1, 1000)).toBe(1);
    expect(intensityBucket(500, 1000)).toBe(3);
  });
});

describe("percentChange", () => {
  it("compares with the previous value", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(75, 100)).toBe(-25);
  });
  it("is null with nothing to compare", () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});
