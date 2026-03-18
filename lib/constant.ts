import type { ConstantInfo, Parser } from "./types.ts";

export function constant<const T>(value: T): Parser<T> {
  return {
    path: [],
    parse(input) {
      return {
        ok: true as const,
        value,
        remainder: input,
      };
    },
    inspect(): ConstantInfo<T> {
      return { type: "constant", value };
    },
    help() {
      return "";
    },
  };
}
