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

export type Attrs<T extends object> =
  & {
    [K in keyof T]: Parser<T[K]>;
  }
  & {};

export type ObjectValue<T extends Record<string, Partial<Parser>>> =
  & {
    [K in keyof T]: T[K] extends Parser<infer V> ? V
      : boolean | undefined;
  }
  & {};

export interface ObjectParser<T extends object>
  extends Parser<T> {
  inspect(input?: Input): ObjectInfo;
}

export function object<T extends Record<string, Partial<Parser>>>(
  attrs: T,
): ObjectParser<ObjectValue<T>> {
  type V = ObjectValue<T>;
  let resolved = Object.fromEntries(
    Object.entries(attrs).map(([key, entry]) => {
      let parser = typeof entry.parse === "function"
        ? entry as Parser
        : { ...field(optionalBoolean), ...entry };
      return [key, parser];
    }),
  ) as Attrs<V>;
  let entries = Object.entries(resolved) as [
    keyof V,
    Parser,
  ][];
  let parsers = entries.map(([key, parser]) => {
    return [key, {
      ...parser,
      path: [String(key), ...parser.path],
    }] as [keyof V, Parser];
  });
  return {
    path: [],
    parse(input) {
      let value = {} as Record<keyof V, unknown>;
      let errors: { path: string[]; error: Error }[] = [];

      let { scoped, args } = scopeInput(parsers, input);

      for (let [key, parser] of parsers) {
        let parsed = parser.parse(scoped.get(key) ?? {});

        if (parsed.ok) {
          value[key] = parsed.value;
        } else {
          errors.push({ path: parser.path, error: parsed.error });
        }
      }

      let remainder: Input = { ...input, args };

      if (errors.length > 0) {
        return {
          ok: false as const,
          error: new ObjectValidationError(errors),
          remainder,
        };
      }

      return {
        ok: true as const,
        value: value as V,
        remainder,
      };
    },
    inspect(input: Input = {}): ObjectInfo {
      let { scoped } = scopeInput(parsers, input);
      let attrs: Record<string, ParserInfo> = {};
      for (let [key, parser] of parsers) {
        attrs[String(key)] = parser.inspect(scoped.get(key) ?? {});
      }
      return { type: "object", attrs };
    },
    help(input: Input = {}): string {
      return format(this.inspect(input), this.path.join("."));
    },
  };
}

// --- internal ---

function asField(parser: Parser): Field<unknown> | undefined {
  return "schema" in parser ? parser as Field<unknown> : undefined;
}

function scopeInput<V>(
  parsers: [keyof V, Parser][],
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
