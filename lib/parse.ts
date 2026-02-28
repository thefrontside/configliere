import assert from "node:assert";
import type { Done, Fail, Input, Parser, Step } from "./types.ts";

export function parseSync<V, D>(
  parser: Parser<[Step<V, D>]>,
  input: Input = {},
): Done<V, D> | Fail {
  let result = parser.parse(input);
  assert(
    !("parse" in result && typeof result.parse === "function"),
    "parser did not complete in a single step",
  );
  return result;
}
