import type { Parser } from "./types.ts";
import { constant } from "./constant.ts";

export function lazy<T>(fn: () => T): Parser<T> {
  return {
    progname: [],
    path: [],
    parse(input) { return constant(fn()).parse(input); },
    inspect(input) { return constant(fn()).inspect(input); },
    help(input) { return constant(fn()).help(input); },
  };
}
