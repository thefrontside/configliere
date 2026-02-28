import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Source } from "./types.ts";

export function validate<T>(
  schema: StandardSchemaV1<T>,
  value: unknown,
): StandardSchemaV1.Result<T> {
  let validation = schema["~standard"].validate(value);
  if (validation instanceof Promise) {
    throw new Error(`async validation is not supported`);
  }
  return validation;
}

export class ValidationError extends Error {
  constructor(public sources: Source<unknown>[]) {
    super(
      sources.flatMap((source) => {
        if (source.issues) {
          return [source.issues.map((i) => i.message)];
        } else {
          return [];
        }
      }).join("\n"),
    );
    this.name = "ValidationError";
  }
}
