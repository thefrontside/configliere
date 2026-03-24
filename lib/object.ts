import type {
  Field,
  ObjectInfo,
  ParseContext,
  Parser,
  ParserInfo,
} from "./types.ts";
import {
  matchAll,
  parseArgument,
  parseLongOption,
  parseLongOptionEql,
  parseNegativeSwitch,
  parseSwitch,
  primitive,
} from "./parse-args.ts";
import { field } from "./field.ts";
import { format } from "./help.ts";
import { optionalBoolean } from "./schema.ts";
import { createContext } from "./context.ts";

export type Attrs<T extends object> = {
  [K in keyof T]: Partial<Parser<T[K]>>;
};

export function object<T extends object>(
  attrs: Attrs<T>,
): Parser<T, ObjectInfo<T>> {
  let entries = Object.entries(attrs).map(([key, value]) => {
    let entry = value as Partial<Parser<unknown>>;
    let parser = typeof entry.parse === "function"
      ? entry as Parser<unknown>
      : Object.assign(field(optionalBoolean), entry);
    return [key as keyof T, parser] as [keyof T, Parser<unknown>];
  });

  let parser: Parser<T, ObjectInfo<T>> = {
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ObjectInfo<T> {
      let { scoped, args } = scopeInput(entries, ctx);
      let attrs: Record<string, ParserInfo<unknown>> = {};
      let value = {} as Record<keyof T, unknown>;
      let errors: { path: string[]; error: Error }[] = [];

      for (let [key, child] of entries) {
        let path = [...ctx.path, String(key)];
        let childCtx = { ...ctx, args, ...(scoped.get(key) ?? {}), path };
        let info = child.inspect(childCtx);
        attrs[String(key)] = info;
        if (info.result.ok) {
          value[key] = info.result.value;
        } else {
          errors.push({ path, error: info.result.error });
        }
      }

      let remainder = { args, values: ctx.values, envs: ctx.envs };
      let result = errors.length > 0
        ? {
          ok: false as const,
          error: new ObjectValidationError(errors),
          remainder,
        }
        : { ok: true as const, value: value as T, remainder };

      let help = {
        progname: [] as string[],
        args: [],
        opts: [],
        commands: [],
      } as ObjectInfo<T>["help"];
      for (let child of Object.values(attrs) as ParserInfo<unknown>[]) {
        help.args.push(...child.help.args);
        help.opts.push(...child.help.opts);
        help.commands.push(...child.help.commands);
      }

      return {
        type: "object",
        parser,
        result,
        remainder,
        attrs,
        help,
      } as ObjectInfo<T>;
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };

  return parser;
}

// --- internal ---

function asField(parser: Parser<unknown>): Field<unknown> | undefined {
  return "schema" in parser ? parser as Field<unknown> : undefined;
}

function scopeInput<V>(
  entries: [keyof V, Parser<unknown>][],
  ctx: ParseContext,
): {
  scoped: Map<
    keyof V,
    {
      values: { name: string; value: unknown }[];
      envs: { name: string; value: Record<string, string> }[];
    }
  >;
  args: string[];
} {
  let cliValues = new Map<keyof V, { name: string; value: unknown }[]>();
  let args = ctx.args;

  if (args.length > 0) {
    let matched = new Set<keyof V>();
    let prev: string[] | undefined;
    while (
      args.length > 0 && (prev === undefined || args.length < prev.length)
    ) {
      prev = args;
      for (let [key, parser] of entries) {
        let f = asField(parser);
        if (!f) continue;
        if (matched.has(key) && !f.array) continue;
        let path = [...ctx.path, String(key)];
        let matcher = matchAll(
          parseSwitch(f.schema, f.aliases ?? []),
          parseNegativeSwitch(f.schema),
          parseLongOption(f.aliases ?? []),
          parseLongOptionEql(),
          parseArgument(f.argument),
        );
        let match = matcher(args, path);
        if (match.matched) {
          let val = primitive(match.value);
          if (f.array) {
            let existing = cliValues.get(key);
            if (existing && existing.length > 0) {
              let last = existing[existing.length - 1];
              (last.value as unknown[]).push(val);
            } else {
              cliValues.set(key, [{ name: "cli", value: [val] }]);
            }
          } else {
            let existing = cliValues.get(key) ?? [];
            existing.push({ name: "cli", value: val });
            cliValues.set(key, existing);
          }
          matched.add(key);
          args = match.remainder;
          break;
        }
      }
    }
  }

  let scoped = new Map<
    keyof V,
    {
      values: { name: string; value: unknown }[];
      envs: { name: string; value: Record<string, string> }[];
    }
  >();
  for (let [key] of entries) {
    scoped.set(key, {
      values: [
        ...ctx.values.flatMap((v) => {
          if (v.value == null) return [];
          let obj = v.value as Record<string, unknown>;
          if (!(String(key) in obj)) return [];
          return [{ name: v.name, value: obj[String(key)] }];
        }),
        ...(cliValues.get(key) ?? []),
      ],
      envs: ctx.envs,
    });
  }

  return { scoped, args };
}

export class ObjectValidationError extends Error {
  constructor(public fields: { path: string[]; error: Error }[]) {
    let message = fields.map(({ path, error }) => {
      return `${path.join(".")}: ${error.message}`;
    }).join("\n");
    super(message);
    this.name = "ObjectValidationError";
  }
}
