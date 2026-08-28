// deno-lint-ignore-file ban-types
import { executable, route } from "./route.ts";
import type { AnyRoute, Definition, Route } from "./types.ts";
import type { AnyRouteElement, Build } from "./elements.ts";

export type CommandZero<N extends string = string> = Route<
  N,
  "help" | "execute",
  {},
  []
>;

export function command<
  const Name extends string,
  const Ds extends readonly (AnyRouteElement)[],
>(
  start: Definition<Name>,
  ...elements: Ds
): Build<Name, "help" | "execute", Ds> {
  const zero = route(start, executable());

  const result = elements.reduce<AnyRoute>(
    (value, element) => (element as (route: AnyRoute) => AnyRoute)(value),
    zero,
  );

  return result as Build<Name, "help" | "execute", Ds>;
}
