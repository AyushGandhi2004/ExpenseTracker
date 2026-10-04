import { describe, expect, it } from "vitest";
import { moveId } from "./reorder";

describe("moveId", () => {
  const ids = ["a", "b", "c"];

  it("moves up and down", () => {
    expect(moveId(ids, "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(ids, "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("returns null at the edges or for unknown ids", () => {
    expect(moveId(ids, "a", -1)).toBeNull();
    expect(moveId(ids, "c", 1)).toBeNull();
    expect(moveId(ids, "z", 1)).toBeNull();
  });

  it("does not mutate the input", () => {
    moveId(ids, "a", 1);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});
