import { assert } from "@std/assert/assert";
import type { Input, Parser, Step } from "../lib/types.ts";
import { parseSync } from "../lib/parse.ts";

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
