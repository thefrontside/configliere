import type {
  ParseContext,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";
import { subtract } from "./available.ts";

export interface PassthroughInfo extends ParserInfo<string[] | undefined> {
  type: "passthrough";
}

export function passthrough(): Parser<string[] | undefined, PassthroughInfo> {
  let parser: Parser<string[] | undefined, PassthroughInfo> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): PassthroughInfo {
      let { prefix, available } = ctx;
      let claims: Token[] = [];
      let value: string[] | undefined;

      let sentinelPos = available.args.findIndex((a) => a.value === "--");
      if (sentinelPos !== -1) {
        let sentinel = available.args[sentinelPos];
        let last = available.args[available.args.length - 1];
        claims.push({ type: "arg", from: sentinel.index, to: last.index });
        value = available.args.slice(sentinelPos + 1).map((a) => a.value);
      }

      let remainder = subtract(available, claims);

      return {
        type: "passthrough",
        parser,
        prefix,
        claims,
        remainder,
        result: { ok: true, value, remainder },
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}
