// deno-lint-ignore-file ban-types
import {
  brand,
  type Check,
  type Fold,
  type Materialize,
  type MethodElement,
  type ModelTransformElement,
  type RoutesElement,
  type Unary,
} from "./pipeline.ts";
import type {
  AnyRoute,
  Definition,
  Done,
  ModelOperation,
  ModelParams,
  Route,
} from "./types.ts";

export type RouteZero<N extends string = string> = Route<
  N,
  "help",
  {},
  [],
  [Done<{}, []>]
>;

export function route<
  const N extends string,
  const E extends readonly Unary[],
>(
  start: Definition<N>,
  ...elements: E & Check<RouteZero<N>, E>
): Materialize<Fold<RouteZero<N>, E>> {
  let zero: RouteZero<N> = {
    ...start,
    methods: ["help"],
    phases: [{
      params: {},
      routes: [],
      values: [],
      envs: [],
    }],
  };

  return elements.reduce<unknown>(
    (value, element) => element(value as never),
    zero,
  ) as Materialize<Fold<RouteZero<N>, E>>;
}

export function version(semver: string): MethodElement<"version"> {
  return brand<MethodElement<"version">>((route: AnyRoute) => ({
    ...route,
    methods: [...route.methods, "version"] as const,
    version: semver,
  }));
}

export function executable(): MethodElement<"execute"> {
  return brand<MethodElement<"execute">>((route: AnyRoute) => ({
    ...route,
    methods: [...route.methods, "execute"] as const,
  }));
}

export function routes<const C extends readonly AnyRoute[]>(
  ...children: C
): RoutesElement<C> {
  return brand<RoutesElement<C>>((route: AnyRoute) => {
    let phases = [...route.phases];
    let phase = phases.pop()!;
    phases.push({
      ...phase,
      routes: [...phase.routes, ...children],
    });

    return {
      ...route,
      phases,
    };
  });
}

export function transform<
  const F extends (
    options: never,
    model: never,
    phase: ModelParams,
  ) => object | void,
  const E extends readonly Unary[],
>(
  transform: F,
  ...elements: E & Check<RouteZero, E>
): ModelTransformElement<F, E> {
  return brand<ModelTransformElement<F, E>>((route: AnyRoute) => {
    let before = keys(route);
    let next = elements.reduce<unknown>(
      (value, element) => element(value as never),
      route,
    ) as AnyRoute;
    let added = keys(next).filter((key) => !before.includes(key));

    let phases = [...next.phases];
    let phase = phases.pop()!;
    phases.push({
      ...phase,
      transforms: [
        ...(phase.transforms ?? []),
        { transform, keys: added } as unknown as ModelOperation,
      ],
    });

    return {
      ...next,
      phases,
    };
  });
}

function keys(route: AnyRoute): string[] {
  let params = route.phases[route.phases.length - 1].params;
  return Object.keys(params);
}
