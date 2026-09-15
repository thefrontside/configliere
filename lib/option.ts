import { type Param, param } from "./param.ts";
import { dasherize } from "./dasherize.ts";
import {
  brand,
  type Check,
  type Fold,
  type ParamElement,
  type Unary,
} from "./pipeline.ts";
import { cli } from "./read.ts";
import type { AnyRoute, Definition } from "./types.ts";

export function option<
  const N extends string,
  const E extends readonly Unary[],
>(
  named: Definition<N>,
  ...elements: E & Check<Param<N, unknown>, E> & Valid<E>
): ElementOf<N, Fold<Param<N, unknown>, E>> {
  const added = elements.reduce<unknown>(
    (value, element) => element(value as never),
    param(named, cli([`--${dasherize(named.name)}`])),
  ) as Param<string, unknown>;

  return brand<ElementOf<N, Fold<Param<N, unknown>, E>>>(
    (route: AnyRoute) => {
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
        phases,
      };
    },
  );
}

type ValueOf<P> = P extends Param<string, infer T> ? T : never;

type Valid<E extends readonly Unary[]> = [
  Fold<Param<string, unknown>, E>,
] extends [never] ? never : unknown;

type ElementOf<N extends string, P> = P extends Param<N, unknown>
  ? ParamElement<N, ValueOf<P>>
  : never;
