import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  FieldInfo,
  HelpInfo,
  ParseResult,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { validate, ValidationError } from "./validate.ts";
import { defaultSource, noneSource, resolve, type Source } from "./source.ts";
import { defineParser } from "./parser.ts";

export interface ArgumentInfo<T> extends ParserInfo<T> {
  type: "argument";
  schema: StandardSchemaV1<T>;
  required: boolean;
  default?: unknown;
  description?: string;
  source: Source<T>;
  sources: Source<T>[];
  // FieldInfo-bridge fields (until help.ts is updated):
  path: string[];
  argument: true;
  array: false;
  boolean: false;
  aliases?: string[];
}

export interface ArgumentOpts<T> {
  default?: T;
  description?: string;
}

export function argument<T>(
  schema: StandardSchemaV1<T>,
  opts: ArgumentOpts<T> = {},
): Parser<T, ArgumentInfo<T>> {
  return defineParser<T, ArgumentInfo<T>>({
    type: "argument",
    description: opts.description,
    claim(ctx) {
      let entry = ctx.available.args.find((a) => !a.value.startsWith("-"));
      if (entry) {
        let token: Token = { type: "arg", from: entry.index, to: entry.index };
        return [token];
      } else {
        return [];
      }
    },
    parse(ctx, claims, remainder) {
      let { prefix } = ctx;
      let sources: Source<T>[] = [noneSource(schema)];
      if (opts.default !== undefined) {
        sources.push(defaultSource(schema, opts.default));
      }

      if (claims.length > 0) {
        let token = claims[0] as Extract<Token, { type: "arg" }>;
        let raw = ctx.read(token)[0];
        let res = validate(schema, raw);
        sources.push({
          sourceType: "cli",
          sourceName: "cli",
          value: (res.issues ? raw : (res as { value: T }).value) as T,
          issues: res.issues,
        });
      }

      let { winner } = resolve(sources);
      let result: ParseResult<T> = winner.issues
        ? { ok: false, error: new ValidationError(sources), remainder }
        : { ok: true, value: winner.value, remainder };

      let help: HelpInfo = {
        progname: ctx.progname,
        args: [],
        opts: [],
        commands: [],
      };
      let extras = {
        result,
        schema,
        required: !!validate(schema, undefined).issues,
        default: opts.default,
        description: opts.description,
        source: winner,
        sources,
        path: prefix.values,
        argument: true as const,
        array: false as const,
        boolean: false as const,
        help,
      };
      // mirror previous behavior: register self in help.args
      help.args.push(extras as unknown as FieldInfo<unknown>);
      return extras;
    },
  });
}
