import { describe, expect, it } from "vitest";
import { applyAmountKey, formatAmountInput, type AmountKey } from "./amount-input";

const type = (keys: string) =>
  [...keys].reduce((value, k) => applyAmountKey(value, (k === "<" ? "back" : k) as AmountKey), "");

describe("applyAmountKey", () => {
  it("types digits", () => {
    expect(type("1250")).toBe("1250");
  });

  it("replaces a lone leading zero", () => {
    expect(type("05")).toBe("5");
    expect(type("000")).toBe("0");
  });

  it("allows one decimal point with at most two digits after it", () => {
    expect(type("12.345")).toBe("12.34");
    expect(type("12..5")).toBe("12.5");
    expect(type(".5")).toBe("0.5");
  });

  it("caps the integer part at 9 digits", () => {
    expect(type("1234567890")).toBe("123456789");
  });

  it("deletes with backspace", () => {
    expect(type("12.5<<")).toBe("12");
    expect(type("<")).toBe("");
  });
});

describe("formatAmountInput", () => {
  it.each([
    ["", "0"],
    ["0", "0"],
    ["1250", "1,250"],
    ["123456", "1,23,456"],
    ["123456.", "1,23,456."],
    ["123456.5", "1,23,456.5"],
    ["0.05", "0.05"],
  ])("%s → %s", (input, expected) => {
    expect(formatAmountInput(input)).toBe(expected);
  });
});
