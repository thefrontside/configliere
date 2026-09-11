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
  ModelOf,
  ModelParams,
  ModelSchema,
  ModelTransform,
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
  const T extends object,
  const E extends readonly Unary[],
>(
  transform: ModelSchema<T>,
  ...elements: E & Check<RouteZero, E>
): ModelTransformElement<ModelSchema<T>, E>;
export function transform<
  const E extends readonly Unary[],
  const F extends ((
    options: ModelOf<Fold<RouteZero, E>>,
    model: never,
    phase: ModelParams,
  ) => Record<string, unknown> | void),
>(
  transform: F,
  ...elements: E & Check<RouteZero, E>
): ModelTransformElement<F, E>;
export function transform(
  transform: ModelTransform,
  ...elements: readonly Unary[]
): ModelTransformElement<ModelTransform, readonly Unary[]> {
  return brand<ModelTransformElement<ModelTransform, readonly Unary[]>>(
    (route: AnyRoute) => {
      let before = params(route);
      let next = apply(route, elements);
      let nextParams = params(next);
      let added = keys(next).filter((key) => before[key] !== nextParams[key]);

      let phases = [...next.phases];
      let phase = phases.pop()!;
      phases.push({
        ...phase,
        transforms: [
          ...(phase.transforms ?? []),
          { transform, keys: added },
        ],
      });

      return {
        ...next,
        phases,
      };
    },
  );
}

function apply(route: AnyRoute, elements: readonly Unary[]): AnyRoute {
  return elements.reduce<unknown>(
    (value, element) => element(value as never),
    route,
  ) as AnyRoute;
}

function params(route: AnyRoute): ModelParams {
  return route.phases[route.phases.length - 1].params;
}

function keys(route: AnyRoute): string[] {
  return Object.keys(params(route));
}
