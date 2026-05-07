import type { Parser, ParserInfo, Token } from "./types.ts";
import { subtract } from "./available.ts";
import { defineParser } from "./parser.ts";

export interface ManyInfo<T> extends ParserInfo<T[]> {
  type: "many";
  iterations: ParserInfo<T>[];
}

export function many<T>(inner: Parser<T>): Parser<T[], ManyInfo<T>> {
  return defineParser<T[], ManyInfo<T>>({
    type: "many",
    claim(ctx) {
      let claims: Token[] = [];
      let av = ctx.available;
      while (true) {
        let inner_claims = inner.claim({ ...ctx, available: av });
        let argClaims = inner_claims.filter((c) => c.type === "arg");
        if (argClaims.length === 0) {
          break;
        } else {
          claims.push(...inner_claims);
          av = subtract(av, inner_claims);
        }
      }
      return claims;
    },
    parse(ctx, _claims, remainder) {
      let values: T[] = [];
      let iterations: ParserInfo<T>[] = [];
      let av = ctx.available;
      while (true) {
        let info = inner.inspect({ ...ctx, available: av });
        let argClaims = info.claims.filter((c) => c.type === "arg");
        if (argClaims.length === 0) {
          break;
        } else {
          if (info.result.ok) {
            values.push(info.result.value);
          }
          iterations.push(info);
          av = subtract(av, info.claims);
        }
      }
      return {
        result: { ok: true, value: values, remainder },
        iterations,
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
  });
}
