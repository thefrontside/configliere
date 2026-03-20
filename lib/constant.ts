import type { ConstantInfo, ParseContext, Parser } from "./types.ts";
import { createContext } from "./context.ts";

export function constant<const T>(value: T): Parser<T, ConstantInfo<T>> {
  let parser: Parser<T, ConstantInfo<T>> = {
    parse(input) {
      return parser.inspect(createContext(input)).result;
    },
    inspect(ctx: ParseContext): ConstantInfo<T> {
      let remainder = { args: ctx.args, values: ctx.values, envs: ctx.envs };
      return {
        type: "constant",
        parser,
        value,
        result: { ok: true, value, remainder },
        remainder,
        help: { progname: [], args: [], opts: [], commands: [] },
      };
    },
    help() {
      return "";
    },
  };
  return parser;
}
