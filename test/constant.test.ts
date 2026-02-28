import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { constant } from "../lib/constant.ts";
import { parseOk } from "./test-helpers.ts";

describe("constant", () => {
  it("parses a constant", () => {
    let value = parseOk(constant("hello world"));
    expect(value).toBe("hello world");
  });
});
