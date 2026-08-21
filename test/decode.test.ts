// deno-lint-ignore-file no-import-prefix
import { expect } from "jsr:@std/expect@^1.0.19";
import { describe, it } from "@std/testing/bdd";
import { number, scalar } from "../lib/decode.ts";

describe("decoders", () => {
  it("offers numeric and text interpretations of a numeral", () => {
    expect(scalar("0012")).toEqual([12, "0012"]);
  });

  it("returns no candidate when a number cannot be decoded", () => {
    expect(number("twelve")).toEqual([]);
  });
});
