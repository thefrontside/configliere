import assert from "node:assert";
import type { Done, Fail, Input, Parser, Step } from "../lib/types.ts";

export function parseOk<V>(
  parser: Parser<[Step<V, unknown>]>,
  input: Input = {},
): V {
  let result = parseSync(parser, input);
  assert(result.ok, "expected parse to succeed, but failed");
  return result.value;
}

export function parseNotOk(
  parser: Parser,
  input: Input,
): Error {
  let result = parseSync(parser, input);
  assert(!result.ok, "expected parse to fail, but succeeded");
  return result.error;
}

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
