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
import type { Definition, OutputOf, Schema } from "./types.ts";

export interface Param<K extends string, T> extends Definition<K> {
  schema: Schema<T>;
  cli: CLIBinding;
  decode: Decoder;
  env?: string;
  multiple?: boolean;
}

export interface MultipleParam<K extends string, T> extends Param<K, T> {
  multiple: true;
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

export function schema<S extends Schema>(
  schema: S,
): TransformElement<SchemaTransform<S>> {
  return mark<SchemaTransform<S>>((param: Param<string, unknown>) => ({
    ...param,
    schema,
  }));
}

export interface SchemaTransform<S extends Schema> extends Transform {
  readonly input: Param<string, unknown>;
  readonly output: this["input"] extends MultipleParam<infer N, unknown>
    ? MultipleParam<N, OutputOf<S>>
    : this["input"] extends Param<infer N, unknown> ? Param<N, OutputOf<S>>
    : never;
}

interface MultipleTransform extends Transform {
  readonly input: Param<string, unknown>;
  readonly output: this["input"] extends Param<infer N, infer T>
    ? MultipleParam<N, T>
    : never;
}

export function multiple(): TransformElement<MultipleTransform> {
  return mark<MultipleTransform>((param: Param<string, unknown>) => ({
    ...param,
    multiple: true,
  }));
}

const unknown: Schema<unknown> = {
  "~standard": {
    version: 1,
    vendor: "configliere",
    validate: (value) => ({ value }),
  },
};
