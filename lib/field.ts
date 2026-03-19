import type { StandardSchemaV1 } from "@standard-schema/spec";

import { validate, ValidationError } from "./validate.ts";
import type { Field, FieldInfo, Input, Source } from "./types.ts";
import { toSnake } from "ts-case-convert";
import { isBoolean } from "./parse-args.ts";
import { format } from "./help.ts";

export function field<T>(
  schema: StandardSchemaV1<T>,
  ...mod: Mod[]
): Field<T> {
  let mods = mod.reduce((all, current) => {
    return current(all);
  }, {
    argument: false,
    array: false,
  } as Mods);

  let f: Field<T> = {
    progname: [],
    path: [],
    required: !!validate(schema, undefined).issues,
    schema,
    argument: mods.argument,
    array: mods.array,
    default: mods.default,
    boolean: isBoolean(schema),
    parse(input) {
      return this.inspect(input).result;
    },
    inspect(input: Input = {}): FieldInfo<T> {
      let sources: Source<T>[] = [];

      // none is always a source (lowest priority)
      let none = validate(schema, undefined);
      sources.push({
        sourceName: "none",
        sourceType: "none",
        value: (none.issues ? undefined : none.value) as T,
        issues: none.issues,
      });

      // default comes after none but before actual input sources
      if (this.default !== undefined) {
        let { issues } = validate(schema, this.default);
        sources.push({
          sourceName: "default",
          sourceType: "default",
          value: this.default as T,
          issues,
        });
      }

      // collect value sources
      for (let value of input.values ?? []) {
        let result = validate(schema, value.value);
        sources.push({
          sourceName: value.name,
          sourceType: "value",
          value: (result.issues ? value.value : result.value) as T,
          issues: result.issues,
        });
      }

      // collect env sources
      let key = this.path.map((el) => toSnake(el).toUpperCase()).join("_");
      for (let env of input.envs ?? []) {
        let strval = env.value[key];
        if (strval === undefined) continue;
        let value = parseEnvValue(this, strval);
        let result = validate(schema, value);
        sources.push({
          sourceName: env.name,
          sourceType: "env",
          value: (result.issues ? value : result.value) as T,
          issues: result.issues,
        });
      }

      // pick the best valid source (last one wins), fall back to last source
      let winner = sources.findLast((s) => !s.issues) ??
        sources[sources.length - 1];

      let result = winner.issues
        ? {
          ok: false as const,
          error: new ValidationError(sources),
          remainder: input,
        }
        : { ok: true as const, value: winner.value as T, remainder: input };

      let info: FieldInfo<T> = {
        type: "field",
        parser: this,
        result,
        path: this.path,
        required: this.required,
        argument: this.argument,
        array: this.array,
        aliases: this.aliases,
        description: this.description,
        default: this.default,
        boolean: this.boolean,
        source: winner,
        sources,
        help: { progname: [], args: [], opts: [], commands: [] },
      };
      if (this.argument) {
        info.help.args.push(info);
      } else {
        info.help.opts.push(info);
      }
      return info;
    },
    help(input: Input = {}) {
      return format(this.inspect(input), this.path.join("."));
    },
  };
  return f;
}

// --- internal ---

function parseEnvValue<T>(field: Field<T>, value: string): unknown {
  if (isBoolean(field.schema)) {
    return parseEnvBoolean(value);
  } else if (field.array) {
    return parseEnvArray(field, value);
  } else if (!isNaN(Number(value))) {
    return Number(value);
  } else {
    return value;
  }
}

function parseEnvBoolean(value: string) {
  switch (value.toLowerCase().trim()) {
    case "true":
    case "yes":
    case "1":
      return true;
    case "false":
    case "no":
    case "0":
      return false;
    default:
      return value;
  }
}

function parseEnvArray(field: Field<unknown>, value: string) {
  return value.split(",").map((s) => s.trim()).map((s) =>
    parseEnvValue(field, s)
  );
}

field.array = (): Mod => {
  return (field) => ({
    ...field,
    array: true,
  });
};

field.default = <T>(value: T): Mod => {
  return (mods) => ({
    ...mods,
    default: value,
  });
};

export const cli: CLIMods = {
  argument(): Mod {
    return (mods) => ({
      ...mods,
      argument: true,
    });
  },
};

export interface CLIMods {
  argument: () => Mod;
}

export interface Mod {
  (mods: Mods): Mods;
}

interface Mods {
  default?: unknown;
  argument: boolean;
  array: boolean;
}
