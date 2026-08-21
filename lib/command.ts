// deno-lint-ignore-file ban-types
import { executable, route } from "./route.ts";
import type { Definition, Route } from "./types.ts";

export type CommandZero<N extends string = string> = Route<
  N,
  "help" | "execute",
  {},
  []
>;

export function command<const N extends string>(
  start: Definition<N>,
): CommandZero<N>;

export function command<const N extends string, A>(
  start: Definition<N>,
  na: (value: CommandZero<N>) => A,
): A;

export function command<const N extends string, A, B>(
  start: Definition<N>,
  na: (value: CommandZero<N>) => A,
  ab: (value: A) => B,
): B;

export function command<const N extends string, A, B, C>(
  start: Definition<N>,
  na: (value: CommandZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
): C;

export function command<const N extends string, A, B, C, D>(
  start: Definition<N>,
  na: (value: CommandZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
): D;

export function command<const N extends string, A, B, C, D, E>(
  start: Definition<N>,
  na: (value: CommandZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
): E;

export function command<const N extends string, A, B, C, D, E, F>(
  start: Definition<N>,
  na: (value: CommandZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
): F;

export function command<
  const N extends string,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
>(
  start: Definition<N>,
  na: (value: CommandZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
): G;

export function command<
  const N extends string,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
>(
  start: Definition<N>,
  na: (value: CommandZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
): H;

export function command<
  const N extends string,
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
  start: Definition<N>,
  na: (value: CommandZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
  hi: (value: H) => I,
): I;

export function command(
  start: Definition<string>,
  ...elements: readonly ((value: never) => unknown)[]
): unknown {
  return elements.reduce<unknown>(
    (value, element) => element(value as never),
    route(start, executable()),
  );
}
