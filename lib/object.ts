import type {
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Prefix,
  Token,
} from "./types.ts";
import { createContext } from "./context.ts";
import { format } from "./help.ts";
import { toEnvCase } from "./case.ts";
import { subtract } from "./available.ts";

export type Attrs<T extends object> = {
  [K in keyof T]: Parser<T[K]>;
};

export function object<T extends object>(
  attrs: Attrs<T>,
): Parser<T, import("./types.ts").ObjectInfo<T>> {
  let parser: Parser<T, import("./types.ts").ObjectInfo<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): import("./types.ts").ObjectInfo<T> {
      let entries = Object.entries(attrs) as [keyof T & string, Parser<unknown>][];
      let result: Record<string, unknown> = {};
      let attrInfos: Record<string, ParserInfo<unknown>> = {};
      let aggClaims: Token[] = [];
      let available = ctx.available;
      let errors: { path: string[]; error: Error }[] = [];

      for (let [key, child] of entries) {
        let childPrefix: Prefix = {
          values: ctx.prefix.values.concat(key),
          envs: ctx.prefix.envs + toEnvCase(key) + "_",
          args: ctx.prefix.args.concat(key),
        };
        let childInfo = child.inspect({
          ...ctx,
          prefix: childPrefix,
          available,
        });
        attrInfos[key] = childInfo;
        aggClaims.push(...childInfo.claims);
        if (childInfo.result.ok) {
          result[key] = childInfo.result.value;
        } else {
          errors.push({
            path: childPrefix.values,
            error: childInfo.result.error,
          });
        }
        // strip all claims (args, values, envs) so next sibling cannot over-claim
        available = subtract(available, childInfo.claims);
      }

      let remainder = available;
      let resultPR: ParseResult<T> = errors.length > 0
        ? {
          ok: false,
          error: new ObjectValidationError(errors),
          remainder,
        }
        : { ok: true, value: result as T, remainder };

      let help: import("./types.ts").ObjectInfo<T>["help"] = {
        progname: ctx.progname,
        args: [],
        opts: [],
        commands: [],
      };
      for (let info of Object.values(attrInfos) as ParserInfo<unknown>[]) {
        help.args.push(...info.help.args);
        help.opts.push(...info.help.opts);
        help.commands.push(...info.help.commands);
      }

      return {
        type: "object",
        parser,
        prefix: ctx.prefix,
        claims: aggClaims,
        remainder,
        result: resultPR,
        attrs: attrInfos as import("./types.ts").ObjectInfo<T>["attrs"],
        help,
      };
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}

export class ObjectValidationError extends Error {
  constructor(public fields: { path: string[]; error: Error }[]) {
    let message = fields.map(({ path, error }) =>
      `${path.join(".")}: ${error.message}`
    ).join("\n");
    super(message);
    this.name = "ObjectValidationError";
  }
}

