import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Source } from "./types.ts";
import { validate } from "./validate.ts";

export type { Source };

export function resolve<T>(sources: Source<T>[]): {
  winner: Source<T>;
} {
  let valid = sources.filter((s) => !s.issues);
  return { winner: valid[valid.length - 1] ?? sources[sources.length - 1] };
}

export function noneSource<T>(schema: StandardSchemaV1<T>): Source<T> {
  let none = validate(schema, undefined);
  return {
    sourceType: "none",
    sourceName: "none",
    value: (none.issues ? undefined : none.value) as T,
    issues: none.issues,
  };
}

export function defaultSource<T>(
  schema: StandardSchemaV1<T>,
  value: unknown,
): Source<T> {
  let { issues } = validate(schema, value);
  return {
    sourceType: "default",
    sourceName: "default",
    value: value as T,
    issues,
  };
}
