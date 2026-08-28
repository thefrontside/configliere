// deno-lint-ignore-file ban-types
import type { AnyRoute, Definition, Method, Route } from "./types.ts";
import type { AnyRouteElement, Build, Element } from "./elements.ts";
import { withRoute } from "./elements.ts";

export type RouteZero<N extends string = string> = Route<N, "help", {}, []>;

export function route<
  const Name extends string,
  const Ds extends readonly (AnyRouteElement)[],
>(
  start: Definition<Name>,
  ...elements: Ds
): Build<Name, "help", Ds> {
  const zero: RouteZero = {
    ...start,
    methods: ["help"],
    params: {},
    children: [],
  };

  const result = elements.reduce<AnyRoute>(
    (value, element) => (element as (route: AnyRoute) => AnyRoute)(value),
    zero,
  );

  return result as Build<Name, "help", Ds>;
}

export function version(
  semver: string,
): Element<"version", {}, readonly []> {
  return withRoute<"version", {}, readonly []>(
    <
      const N extends string,
      const M extends Method,
      const T extends object,
      const C extends readonly AnyRoute[],
    >(route: Route<N, M, T, C>) => ({
      ...route,
      methods: [...route.methods, "version"] as const,
      version: semver,
    }),
  );
}

export function executable(): Element<"execute", {}, readonly []> {
  return withRoute<"execute", {}, readonly []>(
    <
      const N extends string,
      const M extends Method,
      const T extends object,
      const C extends readonly AnyRoute[],
    >(route: Route<N, M, T, C>) => ({
      ...route,
      methods: [...route.methods, "execute"] as const,
    }),
  );
}

export function routes<const C extends readonly AnyRoute[]>(
  ...children: C
): Element<never, {}, C> {
  return withRoute<never, {}, C>(
    <
      const N extends string,
      const M extends Method,
      const T extends object,
      const SC extends readonly AnyRoute[],
    >(route: Route<N, M, T, SC>) => ({
      ...route,
      children: [
        ...route.children,
        ...children,
      ] as unknown as readonly [...SC, ...C],
    }),
  );
}
