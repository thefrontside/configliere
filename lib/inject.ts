import type { Input, ParseContext, Parser, ParserInfo } from "./types.ts";
import { createContext, toAvailable } from "./context.ts";
import { format } from "./help.ts";

export function inject<T, D>(
  fn: (dep: D) => Parser<T>,
): Parser<(dep: D) => Parser<T>> {
  let parser: Parser<(dep: D) => Parser<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ParserInfo<(dep: D) => Parser<T>> {
      let resolve = (dep: D): Parser<T> => {
        let inner = fn(dep);
        return {
          ...inner,
          parse(input, override) {
            let nextCtx = override ?? {
              ...ctx,
              input: input ?? ctx.input,
              available: toAvailable(input ?? ctx.input),
            };
            return inner.inspect(nextCtx).result;
          },
          inspect(override) {
            return inner.inspect(override);
          },
          help(input, override) {
            return inner.help(input ?? ctx.input, override ?? ctx);
          },
        };
      };
      return {
        type: "inject",
        parser,
        prefix: ctx.prefix,
        claims: [],
        remainder: ctx.available,
        result: { ok: true, value: resolve, remainder: ctx.available },
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}
