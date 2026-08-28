import { type Param, param } from "./param.ts";
import { cli } from "./read.ts";
import type { AnyRoute, Definition } from "./types.ts";
import type { Element } from "./elements.ts";

export function option<const N extends string, T>(
  named: Definition<N>,
  ...transforms: readonly ((value: Param<N, unknown>) => Param<N, T>)[]
): Element<never, { [K in N]: T }, readonly []> {
  const transform = ((route: AnyRoute) => {
    const added = transforms.reduce<Param<N, unknown>>(
      (value, element) => element(value),
      param(named, cli([`--${named.name}`])),
    );

    return {
      ...route,
      params: {
        ...route.params,
        [added.name]: added,
      },
    };
  }) as unknown as Element<never, { [K in N]: T }, readonly []>;

  return transform;
}
