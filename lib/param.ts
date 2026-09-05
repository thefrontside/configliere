import { type Decoder, scalar } from "./decode.ts";
import {
  type Check,
  type Fold,
  mark,
  type Transform,
  type TransformElement,
  type Unary,
} from "./pipeline.ts";
import type { CLIBinding } from "./read.ts";
import type { Definition, Schema } from "./types.ts";

export interface Param<K extends string, T> extends Definition<K> {
  schema: Schema<T>;
  cli: CLIBinding;
  decode: Decoder;
  env?: string;
}

export function param<
  const K extends string,
  const E extends readonly Unary[],
>(
  start: Definition<K>,
  ...elements: E & Check<Param<K, unknown>, E>
): Fold<Param<K, unknown>, E> {
  let zero: Param<K, unknown> = {
    ...start,
    schema: unknown,
    cli: {
      read(tokens) {
        let claim = tokens.claimAll(() => false);
        return {
          result: {
            ok: true,
            value: { exists: false },
            issues: [],
          },
          claim,
        };
      },
    },
    decode: scalar,
  };

  return elements.reduce<unknown>(
    (value, element) => element(value as never),
    zero,
  ) as Fold<Param<K, unknown>, E>;
}

export function schema<T>(
  schema: Schema<T>,
): TransformElement<SchemaTransform<T>> {
  return mark<SchemaTransform<T>>((param: Param<string, unknown>) => ({
    ...param,
    schema,
  }));
}

interface SchemaTransform<T> extends Transform {
  readonly input: Param<string, unknown>;
  readonly output: this["input"] extends Param<infer N, unknown> ? Param<N, T>
    : never;
}

const unknown: Schema<unknown> = {
  "~standard": {
    version: 1,
    vendor: "configliere",
    validate: (value) => ({ value }),
  },
};
