import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import assert from "node:assert";
import { lazy } from "../lib/lazy.ts";

describe("lazy", () => {
  it("wraps a factory as a parser", () => {
    let parser = lazy(() => 42);
    let result = parser.parse({});
    assert(result.ok);
    expect(result.value).toEqual(42);
  });

  it("calls the factory on each parse", () => {
    let count = 0;
    let parser = lazy(() => ++count);

    let r1 = parser.parse({});
    let r2 = parser.parse({});
    assert(r1.ok);
    assert(r2.ok);
    expect(r1.value).toEqual(1);
    expect(r2.value).toEqual(2);
  });

  it("passes input through as remainder", () => {
    let parser = lazy(() => "hello");
    let input = { args: ["--foo"] };
    let result = parser.parse(input);
    assert(result.ok);
    expect(result.value).toEqual("hello");
    expect(result.remainder).toEqual(input);
  });
});
