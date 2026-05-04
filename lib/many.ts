import type {
  ParseContext,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";

export interface ManyInfo<T> extends ParserInfo<T[]> {
  type: "many";
  iterations: ParserInfo<T>[];
}

export function many<T>(inner: Parser<T>): Parser<T[], ManyInfo<T>> {
  let parser: Parser<T[], ManyInfo<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ManyInfo<T> {
      let values: T[] = [];
      let claims: Token[] = [];
      let iterations: ParserInfo<T>[] = [];
      let available = ctx.available;

      while (true) {
        let info = inner.inspect({ ...ctx, available });
        let argClaims = info.claims.filter((c) => c.type === "arg");
        if (argClaims.length === 0) break;

        if (info.result.ok) values.push(info.result.value);
        claims.push(...info.claims);
        iterations.push(info);

        let argIdx = new Set<number>();
        for (let c of argClaims) {
          for (let i = c.from; i <= c.to; i++) argIdx.add(i);
        }
        available = { ...available, args: available.args.filter((a) => !argIdx.has(a.index)) };
      }

      return {
        type: "many",
        parser,
        prefix: ctx.prefix,
        claims,
        remainder: available,
        result: { ok: true, value: values, remainder: available },
        iterations,
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}
