import type {
  ParseContext,
  Parser,
  Token,
} from "./types.ts";
import type { ConstantInfo } from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";

export function constant<T>(value: T): Parser<T, ConstantInfo<T>> {
  let parser: Parser<T, ConstantInfo<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ConstantInfo<T> {
      let claims: Token[] = [];
      let remainder = ctx.available;
      return {
        type: "constant",
        parser,
        prefix: ctx.prefix,
        claims,
        remainder,
        result: { ok: true, value, remainder },
        value,
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}

export type { ConstantInfo };
