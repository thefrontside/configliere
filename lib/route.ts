// deno-lint-ignore-file ban-types
import type {
  AnyRoute,
  Definition,
  Method,
  MethodsOf,
  ModelOf,
  Route,
} from "./types.ts";

export type RouteZero<N extends string = string> = Route<N, "help", {}, []>;

export function route<const N extends string>(
  start: Definition<N>,
): RouteZero<N>;

export function route<const N extends string, A>(
  start: Definition<N>,
  na: (value: RouteZero<N>) => A,
): A;

export function route<const N extends string, A, B>(
  start: Definition<N>,
  na: (value: RouteZero<N>) => A,
  ab: (value: A) => B,
): B;

export function route<const N extends string, A, B, C>(
  start: Definition<N>,
  na: (value: RouteZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
): C;

export function route<const N extends string, A, B, C, D>(
  start: Definition<N>,
  na: (value: RouteZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
): D;

export function route<const N extends string, A, B, C, D, E>(
  start: Definition<N>,
  na: (value: RouteZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
): E;

export function route<const N extends string, A, B, C, D, E, F>(
  start: Definition<N>,
  na: (value: RouteZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
): F;

export function route<
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
  na: (value: RouteZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
): G;

export function route<
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
  na: (value: RouteZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
): H;

export function route<
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
  na: (value: RouteZero<N>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
  hi: (value: H) => I,
): I;

export function route(
  start: Definition<string>,
  ...elements: readonly ((value: never) => unknown)[]
): unknown {
  let zero: RouteZero = {
    ...start,
    methods: ["help"],
    params: {},
    children: [],
  };

  return elements.reduce<unknown>(
    (value, element) => element(value as never),
    zero,
  );
}

export function version(
  semver: string,
): <
  const N extends string,
  const M extends Method,
  const T extends object,
  const C extends readonly AnyRoute[],
>(route: Route<N, M, T, C>) => Route<N, M | "version", T, C> {
  return (route) => ({
    ...route,
    methods: [...route.methods, "version"] as const,
    version: semver,
  });
}

export function executable(): <
  const N extends string,
  const M extends Method,
  const T extends object,
  const C extends readonly AnyRoute[],
>(route: Route<N, M, T, C>) => Route<N, M | "execute", T, C> {
  return (route) => ({
    ...route,
    methods: [...route.methods, "execute"] as const,
  });
}

export function routes<const C extends readonly AnyRoute[]>(
  ...children: C
): <R extends AnyRoute>(
  route: R,
) => Route<
  R["name"],
  MethodsOf<R>,
  ModelOf<R>,
  readonly [...R["children"], ...C]
> {
  return <R extends AnyRoute>(route: R) => {
    type Output = Route<
      R["name"],
      MethodsOf<R>,
      ModelOf<R>,
      readonly [...R["children"], ...C]
    >;

    return {
      ...route,
      children: [
        ...route.children,
        ...children,
      ] as unknown as Output["children"],
      params: route.params as Output["params"],
    };
  };
}
