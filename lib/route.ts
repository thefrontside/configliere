// deno-lint-ignore-file ban-types
import {
  brand,
  type Check,
  type DynamicElement,
  type Fold,
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
  ModelTransformContext,
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
): Fold<RouteZero<N>, E> {
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
  ) as Fold<RouteZero<N>, E>;
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
  ...elements: E & Check<RouteZero, E> & SamePhase<E>
): ModelTransformElement<ModelSchema<T>, E>;
export function transform<
  const E extends readonly Unary[],
  const F extends ((
    context: {
      readonly options: ModelOf<Fold<RouteZero, E>>;
      readonly phase: ModelParams;
      readonly addIssue: ModelTransformContext["addIssue"];
    },
  ) => Record<string, unknown> | void),
>(
  transform: F,
  ...elements: E & Check<RouteZero, E> & SamePhase<E>
): ModelTransformElement<F, E>;
export function transform(
  transform: ModelTransform,
  ...elements: readonly Unary[]
): ModelTransformElement<ModelTransform, readonly Unary[]> {
  return brand<ModelTransformElement<ModelTransform, readonly Unary[]>>(
    (route: AnyRoute) => {
      let before = route.phases[route.phases.length - 1].params;
      let previous = route.phases.flatMap((phase) => phase.transforms ?? []);
      // Apply the transform elements first so their parameters and nested transforms define scope.
      let next = elements.reduce<unknown>(
        // Unary erases each input type; Fold and Check enforce composition publicly.
        (value, element) => element(value as never),
        route,
      ) as AnyRoute;
      let nextParams = next.phases[next.phases.length - 1].params;
      // Scope only parameters introduced by these transform elements.
      let added = Object.keys(nextParams).filter((key) =>
        before[key] !== nextParams[key]
      );
      // Nested transforms produce model fields, so track their outputs separately.
      let deps = next.phases.flatMap((phase) => phase.transforms ?? [])
        .filter((op) => !previous.includes(op));

      // Run the transform in the final phase, after all its inputs are bound.
      let phases = [...next.phases];
      let phase = phases.pop()!;
      phases.push({
        ...phase,
        transforms: [
          ...(phase.transforms ?? []),
          { transform, keys: added, deps },
        ],
      });

      return {
        ...next,
        phases,
      };
    },
  );
}

// Transform elements must declare inputs in the phase where the transform runs.
type SamePhase<
  E extends readonly Unary[],
  All extends readonly Unary[] = E,
> = number extends E["length"] ? E
  : E extends readonly [
    infer Head extends Unary,
    ...infer Tail extends readonly Unary[],
  ]
    ? Head extends DynamicElement<infer Requirement, infer Element>
      ? readonly [never, ...Tail]
    : SamePhase<Tail, All>
  : All;
