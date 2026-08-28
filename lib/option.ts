import { extend } from "./extend.ts";
import { type Param, param } from "./param.ts";
import { cli } from "./read.ts";
import type { AnyRoute, Definition, Method, Route } from "./types.ts";

export function option<const N extends string>(
  named: Definition<N>,
): Option<N, unknown>;

export function option<const N extends string, T>(
  named: Definition<N>,
  nt: (value: Param<N, unknown>) => Param<N, T>,
): Option<N, T>;

export function option<const N extends string, A, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  at: (value: A) => Param<N, T>,
): Option<N, T>;

export function option<const N extends string, A, B, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bt: (value: B) => Param<N, T>,
): Option<N, T>;

export function option<const N extends string, A, B, C, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  ct: (value: C) => Param<N, T>,
): Option<N, T>;

export function option<const N extends string, A, B, C, D, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  dt: (value: D) => Param<N, T>,
): Option<N, T>;

export function option<const N extends string, A, B, C, D, E, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  et: (value: E) => Param<N, T>,
): Option<N, T>;

export function option<const N extends string, A, B, C, D, E, F, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  ft: (value: F) => Param<N, T>,
): Option<N, T>;

export function option<
  const N extends string,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  T,
>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gt: (value: G) => Param<N, T>,
): Option<N, T>;

export function option<
  const N extends string,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
  T,
>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
  ht: (value: H) => Param<N, T>,
): Option<N, T>;

export function option(
  named: Definition<string>,
  ...elements: readonly ((value: never) => unknown)[]
): unknown {
  const added = extend(elements)(
    param(named, cli([`--${named.name}`])),
  ) as Param<string, unknown>;

  return (route: AnyRoute) => {
    let phases = [...route.phases];
    let phase = phases.pop()!;
    phases.push({
      ...phase,
      params: {
        ...phase.params,
        [added.name]: added,
      },
    });
    return {
      ...route,
      phases: phases,
    };
  };
}

type Option<K extends string, V> = <
  const N extends string,
  const M extends Method,
  const T extends object,
  const C extends readonly AnyRoute[],
>(
  route: Route<N, M, T, C>,
) => Route<
  N,
  M,
  {
    [P in keyof ({ [Q in K]: V } & T)]: (
      { [Q in K]: V } & T
    )[P];
  },
  C
>;
