import type { AnyRoute, Definition, ModelOf, Route, Schema } from "./types.ts";

export interface Param<K extends string, T> extends Definition<K> {
  schema: Schema<T>;
}

export function param<const K extends string>(
  start: Definition<K>,
): Param<K, unknown>;

export function param<const K extends string, A>(
  start: Definition<K>,
  ka: (value: Param<K, unknown>) => A,
): A;

export function param<const K extends string, A, B>(
  start: Definition<K>,
  ka: (value: Param<K, unknown>) => A,
  ab: (value: A) => B,
): B;

export function param<const K extends string, A, B, C>(
  start: Definition<K>,
  ka: (value: Param<K, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
): C;

export function param<const K extends string, A, B, C, D>(
  start: Definition<K>,
  ka: (value: Param<K, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
): D;

export function param<const K extends string, A, B, C, D, E>(
  start: Definition<K>,
  ka: (value: Param<K, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
): E;

export function param<const K extends string, A, B, C, D, E, F>(
  start: Definition<K>,
  ka: (value: Param<K, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
): F;

export function param<
  const K extends string,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
>(
  start: Definition<K>,
  ka: (value: Param<K, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
): G;

export function param<
  const K extends string,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
>(
  start: Definition<K>,
  ka: (value: Param<K, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
): H;

export function param<
  const K extends string,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
  I,
>(
  start: Definition<K>,
  ka: (value: Param<K, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
  hi: (value: H) => I,
): I;

export function param(
  start: Definition<string>,
  ...elements: readonly ((value: never) => unknown)[]
): unknown {
  let zero = {
    ...start,
    schema: unknown,
  };
  return elements.reduce<unknown>(
    (value, element) => element(value as never),
    zero,
  );
}

export function schema<T>(schema: Schema<T>): <const P extends Param<string,unknown>>(param: P) => Param<P["name"],T> {
  return (param) => ({
    ...param,
    schema,
  });
}

const unknown: Schema<unknown> = {
  "~standard": {
    version: 1,
    vendor: "configliere",
    validate: (value) => ({ value }),
  },
};
