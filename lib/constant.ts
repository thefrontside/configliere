import type { Parser } from "./types.ts";

export function constant<const T>(value: T): Parser<T> {
  return {
    path: [],
    parse(input) {
      return {
        ok: true as const,
        value,
        data: void (0),
        remainder: input,
      };
    },
    inspect() {
      return { args: [], opts: [], commands: [] };
    },
    help() {
      return "";
    },
  };
}
