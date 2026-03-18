import assert from "node:assert";
import type { Done, Fail, Input, Parser } from "../lib/types.ts";

export function parseOk<V>(
  parser: Parser<V>,
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

export function parseSync<V, D = unknown>(
  parser: Parser<V>,
  input: Input = {},
): Done<V, D> | Fail {
  let result = parser.parse(input);
  return result as Done<V, D> | Fail;
}
