import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { boolean, number, scalar } from "../lib/decode.ts";

describe("decoders", () => {
  it("offers numeric and text interpretations of a numeral", () => {
    expect(scalar("0012")).toEqual([12, "0012"]);
  });

  it("returns no candidate when a number cannot be decoded", () => {
    expect(number("twelve")).toEqual([]);
  });

  it("decodes boolean text without treating other text as boolean", () => {
    expect(boolean("true")).toEqual([true]);
    expect(boolean("false")).toEqual([false]);
    expect(boolean("yes")).toEqual([]);
  });
});
