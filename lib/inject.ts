import type { ParseContext, Parser, ParserInfo } from "./types.ts";
import { createContext } from "./context.ts";
import { defineParser } from "./parser.ts";

export function inject<T, D>(
  fn: (dep: D) => Parser<T>,
): Parser<(dep: D) => Parser<T>> {
  return defineParser<(dep: D) => Parser<T>, ParserInfo<(dep: D) => Parser<T>>>({
    type: "inject",
    claim() {
      return [];
    },
    parse(ctx, _claims, remainder) {
      let resolve = (dep: D): Parser<T> => {
        let inner = fn(dep);
        return {
          ...inner,
          parse(input, override) {
            return inner.inspect(override ?? freshCtx(ctx, input)).result;
          },
          inspect(override) {
            return inner.inspect(override);
          },
          help(input, override) {
            return inner.help(undefined, override ?? freshCtx(ctx, input));
          },
        };
      };
      return {
        result: { ok: true, value: resolve, remainder },
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
  });
}

// --- internal ---

function freshCtx(captured: ParseContext, input: import("./types.ts").Input | undefined): ParseContext {
  return {
    ...createContext(input ?? captured.input),
    prefix: captured.prefix,
    progname: captured.progname,
  };
}
