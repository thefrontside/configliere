import { describe, it } from "@std/testing/bdd";
import { lens } from "../lib/lens.ts";
import { expect } from "@std/expect";

describe("lens", () => {
  describe("set", () => {
    it("sets deeply nested structures", () => {
      let result = lens.set(["one", "two", "three"], "Hello World", {});
      expect(result).toEqual({ one: { two: { three: "Hello World" } } });
    });
  });
});
