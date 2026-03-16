import type { StandardSchemaV1 } from "@standard-schema/spec";

import { validate, ValidationError } from "./validate.ts";
import type { Field, Mods, Source } from "./types.ts";
import { toSnake } from "ts-case-convert";
import { isBoolean } from "./parse-args.ts";

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

  let field: Field<T> = {
    path: [],
    required: !!validate(schema, undefined).issues,
    schema,
    mods,
    parse(input) {
      let sources: Source<T>[] = [];

      // collect object sources
      for (let value of input.values ?? []) {
        let result = validate(schema, value.value);
        sources.push({
          sourceName: value.name,
          sourceType: "object",
          value: (result.issues ? value.value : result.value) as T,
          issues: result.issues,
        });
      }

      // collect env sources
      let key = this.path.map((el) => toSnake(el).toUpperCase()).join("_");
      for (let env of input.envs ?? []) {
        let strval = env.value[key];
        if (strval === undefined) continue;
        let value = parseEnvValue(field, strval);
        let result = validate(schema, value);
        sources.push({
          sourceName: env.name,
          sourceType: "env",
          value: (result.issues ? value : result.value) as T,
          issues: result.issues,
        });
      }

      // pick the best valid source from inputs (last one wins)
      let winner = sources.findLast((s) => !s.issues);
      if (winner) {
        return {
          ok: true as const,
          value: winner.value,
          data: { source: winner, sources },
          remainder: input,
        };
      }

      // try default
      if (mods.default !== undefined) {
        let result = validate(schema, mods.default);
        let source: Source<T> = {
          sourceName: "default",
          sourceType: "default",
          value: (result.issues ? mods.default : result.value) as T,
          issues: result.issues,
        };
        sources.push(source);
        if (!result.issues) {
          return {
            ok: true as const,
            value: source.value,
            data: { source, sources },
            remainder: input,
          };
        }
      }

      // try undefined (optional fields or schema-level defaults)
      let result = validate(schema, undefined);
      let source: Source<T> = {
        sourceName: "none",
        sourceType: "none",
        value: (result.issues ? undefined : result.value) as T,
        issues: result.issues,
      };
      sources.push(source);

      if (!result.issues) {
        return {
          ok: true as const,
          value: source.value,
          data: { source, sources },
          remainder: input,
        };
      }

      return {
        ok: false as const,
        error: new ValidationError(sources),
        remainder: input,
      };
    },
  };
  return field;
}

function parseEnvValue<T>(field: Field<T>, value: string): unknown {
  if (isBoolean(field.schema)) {
    return parseEnvBoolean(value);
  } else if (field.mods.array) {
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
