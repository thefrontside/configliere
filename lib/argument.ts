import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { validate, ValidationError } from "./validate.ts";
import { createContext } from "./context.ts";
import { defaultSource, noneSource, resolve, type Source } from "./source.ts";
import { format } from "./help.ts";
import { subtract } from "./available.ts";

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
  let parser: Parser<T, ArgumentInfo<T>> = {
    description: opts.description,
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ArgumentInfo<T> {
      let { prefix, available } = ctx;
      let claims: Token[] = [];
      let sources: Source<T>[] = [noneSource(schema)];
      if (opts.default !== undefined) {
        sources.push(defaultSource(schema, opts.default));
      }

      let entry = available.args.find((a) => !a.value.startsWith("-"));
      if (entry) {
        claims.push({ type: "arg", from: entry.index, to: entry.index });
        let res = validate(schema, entry.value);
        sources.push({
          sourceType: "cli",
          sourceName: "cli",
          value: (res.issues ? entry.value : (res as { value: T }).value) as T,
          issues: res.issues,
        });
      }

      let { winner } = resolve(sources);
      let remainder = subtract(available, claims);
      let result: ParseResult<T> = winner.issues
        ? { ok: false, error: new ValidationError(sources), remainder }
        : { ok: true, value: winner.value, remainder };

      let info: ArgumentInfo<T> = {
        type: "argument",
        parser,
        prefix,
        claims,
        remainder,
        result,
        schema,
        required: !!validate(schema, undefined).issues,
        default: opts.default,
        description: opts.description,
        source: winner,
        sources,
        path: prefix.values,
        argument: true,
        array: false,
        boolean: false,
        help: { progname: ctx.progname, args: [], opts: [], commands: [] },
      };
      info.help.args.push(info as unknown as import("./types.ts").FieldInfo<unknown>);
      return info;
    },
    help(input, ctx) {
      let info = parser.inspect(ctx ?? createContext(input));
      return format(info, info.prefix.args.join("."));
    },
  };
  return parser;
}
