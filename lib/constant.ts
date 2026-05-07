import type { ConstantInfo, Parser } from "./types.ts";
import { defineParser } from "./parser.ts";

export function constant<T>(value: T): Parser<T, ConstantInfo<T>> {
  return defineParser<T, ConstantInfo<T>>({
    type: "constant",
    claim() {
      return [];
    },
    parse(ctx, _claims, remainder) {
      return {
        result: { ok: true, value, remainder },
        value,
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
  });
}

export type { ConstantInfo };
