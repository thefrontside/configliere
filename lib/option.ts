import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  AvailableInput,
  FieldInfo,
  ParseContext,
  ParseResult,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { validate, ValidationError } from "./validate.ts";
import { isBoolean } from "./schema.ts";
import { toKebabCase } from "./case.ts";
import { createContext } from "./context.ts";
import { defaultSource, noneSource, resolve, type Source } from "./source.ts";
import { format } from "./help.ts";

export interface OptionInfo<T> extends ParserInfo<T> {
  type: "option";
  schema: StandardSchemaV1<T>;
  required: boolean;
  boolean: boolean;
  default?: unknown;
  aliases?: string[];
  description?: string;
  source: Source<T>;
  sources: Source<T>[];
  /** path mirrors prefix.args for help-formatting compatibility */
  path: string[];
  argument: false;
  array: false;
}

export interface OptionOpts<T> {
  default?: T;
  aliases?: string[];
  description?: string;
}

export function option<T>(
  schema: StandardSchemaV1<T>,
  opts: OptionOpts<T> = {},
): Parser<T, OptionInfo<T>> {
  let parser: Parser<T, OptionInfo<T>> = {
    description: opts.description,
    aliases: opts.aliases,
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): OptionInfo<T> {
      return inspectOption(parser, schema, opts, ctx);
    },
    help(input, ctx) {
      let info = parser.inspect(ctx ?? createContext(input));
      return format(info, info.prefix.args.join("."));
    },
  };
  return parser;
}

// --- internal ---

function inspectOption<T>(
  parser: Parser<T, OptionInfo<T>>,
  schema: StandardSchemaV1<T>,
  opts: OptionOpts<T>,
  ctx: ParseContext,
): OptionInfo<T> {
  let { prefix, available } = ctx;
  let claims: Token[] = [];
  let sources: Source<T>[] = [noneSource(schema)];
  if (opts.default !== undefined) {
    sources.push(defaultSource(schema, opts.default));
  }

  // values: one claim per source if path matches
  for (let entry of available.values) {
    let value = readPath(entry.value, prefix.values);
    if (value === undefined) continue;
    claims.push({ type: "value", source: entry.source, path: prefix.values });
    let res = validate(schema, value);
    sources.push({
      sourceType: "value",
      sourceName: entry.source,
      value: (res.issues ? value : (res as { value: T }).value) as T,
      issues: res.issues,
    });
  }

  // envs: one claim per source if name matches
  let envName = prefix.envs.endsWith("_")
    ? prefix.envs.slice(0, -1)
    : prefix.envs;
  for (let entry of available.envs) {
    let raw = entry.value[envName];
    if (raw === undefined) continue;
    claims.push({ type: "env", source: entry.source, name: envName });
    let coerced = coerceEnvValue(schema, raw);
    let res = validate(schema, coerced);
    sources.push({
      sourceType: "env",
      sourceName: entry.source,
      value: (res.issues ? coerced : (res as { value: T }).value) as T,
      issues: res.issues,
    });
  }

  // args: first match
  let argMatch = matchArgs(schema, prefix, opts.aliases ?? [], available);
  if (argMatch) {
    claims.push(argMatch.token);
    let res = validate(schema, argMatch.value);
    sources.push({
      sourceType: "cli",
      sourceName: "cli",
      value: (res.issues ? argMatch.value : (res as { value: T }).value) as T,
      issues: res.issues,
    });
  }

  let { winner } = resolve(sources);
  let remainder = subtractClaims(available, claims);
  let result: ParseResult<T> = winner.issues
    ? { ok: false, error: new ValidationError(sources), remainder }
    : { ok: true, value: winner.value, remainder };

  let info: OptionInfo<T> = {
    type: "option",
    parser,
    prefix,
    claims,
    remainder,
    result,
    schema,
    required: !!validate(schema, undefined).issues,
    boolean: isBoolean(schema),
    default: opts.default,
    aliases: opts.aliases,
    description: opts.description,
    source: winner,
    sources,
    path: prefix.args,
    argument: false,
    array: false,
    help: { progname: ctx.progname, args: [], opts: [], commands: [] },
  };
  info.help.opts.push(info as unknown as FieldInfo<unknown>);
  return info;
}

function readPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (let segment of path) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function coerceEnvValue<T>(schema: StandardSchemaV1<T>, raw: string): unknown {
  if (isBoolean(schema)) {
    let lower = raw.toLowerCase().trim();
    if (lower === "true" || lower === "yes" || lower === "1") return true;
    if (lower === "false" || lower === "no" || lower === "0") return false;
    return raw;
  }
  let n = Number(raw);
  if (!isNaN(n)) return n;
  return raw;
}

function optionName(prefix: { args: string[] }): string {
  return `--${toKebabCase(prefix.args.join(".")).toLowerCase()}`;
}

function negatedOptionName(prefix: { args: string[] }): string {
  return `--no-${toKebabCase(prefix.args.join(".")).toLowerCase()}`;
}

function matchArgs<T>(
  schema: StandardSchemaV1<T>,
  prefix: { args: string[] },
  aliases: string[],
  available: AvailableInput,
): { token: Token; value: unknown } | undefined {
  let name = optionName(prefix);
  let nameEq = `${name}=`;
  let neg = negatedOptionName(prefix);
  let isBool = isBoolean(schema);

  for (let i = 0; i < available.args.length; i++) {
    let entry = available.args[i];
    let v = entry.value;
    let next = available.args[i + 1];

    if (isBool && v === name) {
      return { token: { type: "arg", from: entry.index, to: entry.index }, value: true };
    }
    if (isBool && v === neg) {
      return { token: { type: "arg", from: entry.index, to: entry.index }, value: false };
    }
    if (v.startsWith(nameEq)) {
      let raw = v.slice(nameEq.length);
      return {
        token: { type: "arg", from: entry.index, to: entry.index },
        value: isBool ? coerceBool(raw) : raw,
      };
    }
    // alias short forms (top-level only)
    if (prefix.args.length === 1) {
      for (let alias of aliases) {
        if (v === alias) {
          if (isBool) {
            return { token: { type: "arg", from: entry.index, to: entry.index }, value: true };
          }
          if (next && !next.value.startsWith("-")) {
            return {
              token: { type: "arg", from: entry.index, to: next.index },
              value: next.value,
            };
          }
        }
      }
    }
    // --name VAL (two-token form)
    if (!isBool && v === name && next && !next.value.startsWith("-")) {
      return {
        token: { type: "arg", from: entry.index, to: next.index },
        value: next.value,
      };
    }
  }
  return undefined;
}

function coerceBool(raw: string): boolean | string {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function subtractClaims(av: AvailableInput, claims: Token[]): AvailableInput {
  let argIdx = new Set<number>();
  for (let t of claims) {
    if (t.type === "arg") {
      for (let i = t.from; i <= t.to; i++) argIdx.add(i);
    }
  }
  return {
    args: av.args.filter((a) => !argIdx.has(a.index)),
    values: av.values, // values entries remain accessible to siblings sharing the source
    envs: av.envs, // env entries remain accessible to siblings sharing the source
  };
}
