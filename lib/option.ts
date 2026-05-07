import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  AvailableInput,
  FieldInfo,
  HelpInfo,
  ParseResult,
  Parser,
  ParserInfo,
  Prefix,
  Token,
} from "./types.ts";
import { validate, ValidationError } from "./validate.ts";
import { isBoolean } from "./schema.ts";
import { toKebabCase } from "./case.ts";
import { defaultSource, noneSource, resolve, type Source } from "./source.ts";
import { defineParser } from "./parser.ts";

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
  return defineParser<T, OptionInfo<T>>({
    type: "option",
    description: opts.description,
    aliases: opts.aliases,
    claim(ctx) {
      let { prefix, available } = ctx;
      let claims: Token[] = [];

      // values
      for (let entry of available.values) {
        let v = readPath(entry.value, prefix.values);
        if (v !== undefined) {
          claims.push({
            type: "value",
            source: entry.source,
            path: prefix.values,
          });
        }
      }

      // envs
      let envName = prefix.envs.endsWith("_")
        ? prefix.envs.slice(0, -1)
        : prefix.envs;
      for (let entry of available.envs) {
        if (entry.value[envName] !== undefined) {
          claims.push({ type: "env", source: entry.source, name: envName });
        }
      }

      // args
      let argToken = matchArgs(schema, prefix, opts.aliases ?? [], available);
      if (argToken) {
        claims.push(argToken);
      }

      return claims;
    },
    parse(ctx, claims, remainder) {
      let { prefix } = ctx;
      let sources: Source<T>[] = [noneSource(schema)];
      if (opts.default !== undefined) {
        sources.push(defaultSource(schema, opts.default));
      }

      for (let t of claims) {
        if (t.type === "value") {
          let v = ctx.read(t);
          let res = validate(schema, v);
          sources.push({
            sourceType: "value",
            sourceName: t.source,
            value: (res.issues ? v : (res as { value: T }).value) as T,
            issues: res.issues,
          });
        } else if (t.type === "env") {
          let raw = ctx.read(t);
          let coerced = coerceValue(schema, raw);
          let res = validate(schema, coerced);
          sources.push({
            sourceType: "env",
            sourceName: t.source,
            value: (res.issues ? coerced : (res as { value: T }).value) as T,
            issues: res.issues,
          });
        } else {
          let slice = ctx.read(t);
          let v = extractOptionValue(schema, prefix, slice);
          let res = validate(schema, v);
          sources.push({
            sourceType: "cli",
            sourceName: "cli",
            value: (res.issues ? v : (res as { value: T }).value) as T,
            issues: res.issues,
          });
        }
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
        boolean: isBoolean(schema),
        default: opts.default,
        aliases: opts.aliases,
        description: opts.description,
        source: winner,
        sources,
        path: prefix.args,
        argument: false as const,
        array: false as const,
        help,
      };
      help.opts.push(extras as unknown as FieldInfo<unknown>);
      return extras;
    },
  });
}

// --- internal ---

function readPath(value: unknown, path: string[]): unknown {
  let cur: unknown = value;
  for (let s of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[s];
  }
  return cur;
}

function coerceValue<T>(schema: StandardSchemaV1<T>, raw: string): unknown {
  if (isBoolean(schema)) {
    let lower = raw.toLowerCase().trim();
    if (lower === "true" || lower === "yes" || lower === "1") return true;
    if (lower === "false" || lower === "no" || lower === "0") return false;
    return raw;
  }
  let n = Number(raw);
  if (!isNaN(n) && !validate(schema, n).issues) return n;
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
): Token | undefined {
  let name = optionName(prefix);
  let nameEq = `${name}=`;
  let neg = negatedOptionName(prefix);
  let isBool = isBoolean(schema);

  for (let i = 0; i < available.args.length; i++) {
    let entry = available.args[i];
    let v = entry.value;
    let next = available.args[i + 1];

    if (isBool && (v === name || v === neg)) {
      return { type: "arg", from: entry.index, to: entry.index };
    }
    if (v.startsWith(nameEq)) {
      return { type: "arg", from: entry.index, to: entry.index };
    }
    // alias short forms (top-level only)
    if (prefix.args.length === 1) {
      for (let alias of aliases) {
        if (v === alias) {
          if (isBool) {
            return { type: "arg", from: entry.index, to: entry.index };
          }
          if (next && !next.value.startsWith("-")) {
            return { type: "arg", from: entry.index, to: next.index };
          }
        }
      }
    }
    // --name VAL (two-token form)
    if (!isBool && v === name && next && !next.value.startsWith("-")) {
      return { type: "arg", from: entry.index, to: next.index };
    }
  }
  return undefined;
}

function extractOptionValue<T>(
  schema: StandardSchemaV1<T>,
  prefix: Prefix,
  slice: string[],
): unknown {
  let isBool = isBoolean(schema);
  let head = slice[0];
  let name = optionName(prefix);
  let nameEq = `${name}=`;
  let neg = negatedOptionName(prefix);

  if (head === neg) return false;
  if (head === name) {
    // either bare boolean (slice length 1) or `--name VAL` two-token form
    if (slice.length === 1) {
      return isBool ? true : undefined;
    }
    return isBool ? coerceBool(slice[1]) : coerceValue(schema, slice[1]);
  }
  if (head.startsWith(nameEq)) {
    let raw = head.slice(nameEq.length);
    return isBool ? coerceBool(raw) : coerceValue(schema, raw);
  }
  // alias short form: `-a` or `-a VAL`
  if (slice.length === 1) {
    return isBool ? true : undefined;
  }
  return coerceValue(schema, slice[1]);
}

function coerceBool(raw: string): boolean | string {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}
