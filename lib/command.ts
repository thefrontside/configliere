// deno-lint-ignore-file ban-types
import { executable, route, type RouteZero } from "./route.ts";
import type { Route } from "./types.ts";

export type CommandZero<N extends string = string> = Route<
  N,
  "help" | "execute",
  {},
  []
>;

export function command<const S extends RouteZero>(
  start: S,
): CommandZero<S["name"]>;

export function command<const S extends RouteZero, A>(
  start: S,
  sa: (value: CommandZero<S["name"]>) => A,
): A;

export function command<const S extends RouteZero, A, B>(
  start: S,
  sa: (value: CommandZero<S["name"]>) => A,
  ab: (value: A) => B,
): B;

export function command<const S extends RouteZero, A, B, C>(
  start: S,
  sa: (value: CommandZero<S["name"]>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
): C;

export function command<const S extends RouteZero, A, B, C, D>(
  start: S,
  sa: (value: CommandZero<S["name"]>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
): D;

export function command<const S extends RouteZero, A, B, C, D, E>(
  start: S,
  sa: (value: CommandZero<S["name"]>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
): E;

export function command<const S extends RouteZero, A, B, C, D, E, F>(
  start: S,
  sa: (value: CommandZero<S["name"]>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
): F;

export function command<
  const S extends RouteZero,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
>(
  start: S,
  sa: (value: CommandZero<S["name"]>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
): G;

export function command<
  const S extends RouteZero,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
>(
  start: S,
  sa: (value: CommandZero<S["name"]>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
): H;

export function command<
  const S extends RouteZero,
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
  start: S,
  sa: (value: CommandZero<S["name"]>) => A,
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
  start: RouteZero,
  ...elements: readonly ((value: never) => unknown)[]
): unknown {
  return elements.reduce<unknown>(
    (value, element) => element(value as never),
    route(start, executable()),
  );
}
