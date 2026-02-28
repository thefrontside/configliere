import type { Parser, Step } from "./types.ts";

export function constant<const T>(value: T): Parser<[Step<T, void>]> {
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
  };
}
