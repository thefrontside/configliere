import type { ParseContext, Parser, ParserInfo } from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";

export function inject<T, D>(
  fn: (dep: D) => Parser<T>,
): Parser<(dep: D) => Parser<T>> {
  let parser: Parser<(dep: D) => Parser<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ParserInfo<(dep: D) => Parser<T>> {
      let remainder = { args: ctx.args, values: ctx.values, envs: ctx.envs };
      let resolve = (dep: D): Parser<T> => {
        let inner = fn(dep);
        return {
          ...inner,
          parse(input, override) {
            return inner.inspect(
              override ?? {
                ...ctx,
                args: input?.args ?? ctx.args,
                values: input?.values ?? ctx.values,
                envs: input?.envs ?? ctx.envs,
              },
            ).result;
          },
          inspect(override) {
            return inner.inspect(override);
          },
          help(input, override) {
            return inner.help({
              args: input?.args ?? ctx.args,
              values: input?.values ?? ctx.values,
              envs: input?.envs ?? ctx.envs,
            }, override ?? ctx);
          },
        };
      };
      return {
        type: "inject",
        parser,
        result: { ok: true, value: resolve, remainder },
        remainder,
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}
