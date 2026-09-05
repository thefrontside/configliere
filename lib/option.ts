import { type Param, param } from "./param.ts";
import { brand, type ParamElement } from "./pipeline.ts";
import { cli } from "./read.ts";
import type { AnyRoute, Definition } from "./types.ts";

export function option<const N extends string>(
  named: Definition<N>,
): ParamElement<N, unknown>;

export function option<const N extends string, T>(
  named: Definition<N>,
  nt: (value: Param<N, unknown>) => Param<N, T>,
): ParamElement<N, T>;

export function option<const N extends string, A, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  at: (value: A) => Param<N, T>,
): ParamElement<N, T>;

export function option<const N extends string, A, B, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bt: (value: B) => Param<N, T>,
): ParamElement<N, T>;

export function option<const N extends string, A, B, C, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  ct: (value: C) => Param<N, T>,
): ParamElement<N, T>;

export function option<const N extends string, A, B, C, D, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  dt: (value: D) => Param<N, T>,
): ParamElement<N, T>;

export function option<const N extends string, A, B, C, D, E, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  et: (value: E) => Param<N, T>,
): ParamElement<N, T>;

export function option<const N extends string, A, B, C, D, E, F, T>(
  named: Definition<N>,
  na: (value: Param<N, unknown>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  ft: (value: F) => Param<N, T>,
): ParamElement<N, T>;

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
): ParamElement<N, T>;

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
): ParamElement<N, T>;

export function option(
  named: Definition<string>,
  ...elements: readonly ((value: never) => unknown)[]
): unknown {
  const added = elements.reduce<unknown>(
    (value, element) => element(value as never),
    param(named, cli([`--${named.name}`])),
  ) as Param<string, unknown>;

  return brand<ParamElement<string, unknown>>((route: AnyRoute) => {
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
  });
}
