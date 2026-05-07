import type {
  AvailableInput,
  ObjectInfo,
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Prefix,
  Token,
} from "./types.ts";
import { toEnvCase } from "./case.ts";
import { subtract } from "./available.ts";
import { defineParser } from "./parser.ts";

export type Attrs<T extends object> = {
  [K in keyof T]: Parser<T[K]>;
};

export function object<T extends object>(
  attrs: Attrs<T>,
): Parser<T, ObjectInfo<T>> {
  let entries = Object.entries(attrs) as [keyof T & string, Parser<unknown>][];

  return defineParser<T, ObjectInfo<T>>({
    type: "object",
    claim(ctx) {
      let claims: Token[] = [];
      let av = ctx.available;
      for (let [key, child] of entries) {
        let childCtx: ParseContext = {
          ...ctx,
          prefix: childPrefix(ctx.prefix, key),
          available: av,
        };
        let inner = child.claim(childCtx);
        claims.push(...inner);
        av = subtract(av, inner);
      }
      return claims;
    },
    parse(ctx, _claims, remainder) {
      let value: Record<string, unknown> = {};
      let infos: Record<string, ParserInfo<unknown>> = {};
      let errors: { path: string[]; error: Error }[] = [];
      let av: AvailableInput = ctx.available;

      for (let [key, child] of entries) {
        let prefix = childPrefix(ctx.prefix, key);
        let childCtx: ParseContext = { ...ctx, prefix, available: av };
        let info = child.inspect(childCtx);
        infos[key] = info;
        if (info.result.ok) {
          value[key] = info.result.value;
        } else {
          errors.push({ path: prefix.values, error: info.result.error });
        }
        av = subtract(av, info.claims);
      }

      let result: ParseResult<T> = errors.length > 0
        ? {
          ok: false,
          error: new ObjectValidationError(errors),
          remainder,
        }
        : { ok: true, value: value as T, remainder };

      let help: ObjectInfo<T>["help"] = {
        progname: ctx.progname,
        args: [],
        opts: [],
        commands: [],
      };
      for (let info of Object.values(infos) as ParserInfo<unknown>[]) {
        help.args.push(...info.help.args);
        help.opts.push(...info.help.opts);
        help.commands.push(...info.help.commands);
      }

      return {
        result,
        attrs: infos as ObjectInfo<T>["attrs"],
        help,
      };
    },
  });
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

// --- internal ---

function childPrefix(parent: Prefix, key: string): Prefix {
  return {
    values: parent.values.concat(key),
    envs: parent.envs + toEnvCase(key) + "_",
    args: parent.args.concat(key),
  };
}
