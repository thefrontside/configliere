import type { Field, Input, ObjectInfo, Parser, ParserInfo } from "./types.ts";
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

export type Attrs<T extends object> = {
  [K in keyof T]: Partial<Parser<T[K]>>;
};

export function object<T extends object>(
  attrs: Attrs<T>,
): Parser<T, ObjectInfo<T>> {
  let resolved = Object.fromEntries(
    Object.entries(attrs).map(([key, value]) => {
      let entry = value as Partial<Parser<unknown>>;
      let parser = typeof entry.parse === "function"
        ? entry as Parser<unknown>
        : Object.assign(field(optionalBoolean), entry);
      return [key, parser];
    }),
  ) as Record<string, Parser<unknown>>;
  let entries = Object.entries(resolved) as [
    keyof T,
    Parser<unknown>,
  ][];
  let parsers = entries.map(([key, parser]) => {
    parser.path = [String(key), ...parser.path];
    return [key, parser] as [keyof T, Parser<unknown>];
  });
  let parser: Parser<T, ObjectInfo<T>> = {
    progname: [],
    path: [],
    parse(input) {
      return parser.inspect(input).result;
    },
    inspect(input: Input = {}): ObjectInfo<T> {
      let { scoped, args } = scopeInput(parsers, input);
      let attrs: Record<string, ParserInfo<unknown>> = {};
      let value = {} as Record<keyof T, unknown>;
      let errors: { path: string[]; error: Error }[] = [];

      for (let [key, parser] of parsers) {
        let info = parser.inspect(scoped.get(key) ?? {});
        attrs[String(key)] = info;
        if (info.result.ok) {
          value[key] = info.result.value;
        } else {
          errors.push({ path: parser.path, error: info.result.error });
        }
      }

      let remainder: Input = { ...input, args };
      let result = errors.length > 0
        ? { ok: false as const, error: new ObjectValidationError(errors), remainder }
        : { ok: true as const, value: value as T, remainder };

      let help = { progname: [] as string[], args: [], opts: [], commands: [] } as ObjectInfo<T>["help"];
      for (let child of Object.values(attrs) as ParserInfo<unknown>[]) {
        help.args.push(...child.help.args);
        help.opts.push(...child.help.opts);
        help.commands.push(...child.help.commands);
      }

      return { type: "object", parser, result, attrs, help } as ObjectInfo<T>;
    },
    help(input: Input = {}): string {
      return format(parser.inspect(input), parser.path.join("."));
    },
  };

  return parser;
}

// --- internal ---

function asField(parser: Parser<unknown>): Field<unknown> | undefined {
  return "schema" in parser ? parser as Field<unknown> : undefined;
}

function scopeInput<V>(
  parsers: [keyof V, Parser<unknown>][],
  input: Input,
): { scoped: Map<keyof V, Input>; args: string[] } {
  let cliValues = new Map<keyof V, { name: string; value: unknown }[]>();
  let args = input.args ?? [];

  if (args.length > 0) {
    let matched = new Set<keyof V>();
    let prev: string[] | undefined;
    while (args.length > 0 && (prev === undefined || args.length < prev.length)) {
      prev = args;
      for (let [key, parser] of parsers) {
        let f = asField(parser);
        if (!f) continue;
        if (matched.has(key) && !f.array) continue;
        let matcher = matchAll(
          parseSwitch(f.schema, f.aliases ?? []),
          parseNegativeSwitch(f.schema),
          parseLongOption(f.aliases ?? []),
          parseLongOptionEql(),
          parseArgument(f.argument),
        );
        let match = matcher(args, parser.path);
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

  let scoped = new Map<keyof V, Input>();
  for (let [key] of parsers) {
    scoped.set(key, {
      values: [
        ...(input.values ?? []).flatMap((v) => {
          if (v.value == null) return [];
          let obj = v.value as Record<string, unknown>;
          if (!(String(key) in obj)) return [];
          return [{ name: v.name, value: obj[String(key)] }];
        }),
        ...(cliValues.get(key) ?? []),
      ],
      envs: input.envs,
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
