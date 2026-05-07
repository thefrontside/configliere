import type { Parser, ParserInfo, Token } from "./types.ts";
import { defineParser } from "./parser.ts";

export interface PassthroughInfo extends ParserInfo<string[] | undefined> {
  type: "passthrough";
}

export function passthrough(): Parser<string[] | undefined, PassthroughInfo> {
  return defineParser<string[] | undefined, PassthroughInfo>({
    type: "passthrough",
    claim(ctx) {
      let { args } = ctx.available;
      let pos = args.findIndex((a) => a.value === "--");
      if (pos === -1) {
        return [];
      } else {
        let sentinel = args[pos];
        let last = args[args.length - 1];
        let token: Token = { type: "arg", from: sentinel.index, to: last.index };
        return [token];
      }
    },
    parse(ctx, claims, remainder) {
      let value: string[] | undefined;
      if (claims.length > 0) {
        let slice = ctx.read(claims[0] as Extract<Token, { type: "arg" }>);
        // slice includes the leading "--" sentinel; drop it
        value = slice.slice(1);
      }
      return {
        result: { ok: true, value, remainder },
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
  });
}
