// deno-lint-ignore-file ban-types
import type { AnyRoute, Route, Schema } from "./types.ts";

export function route<const S extends Route<string, {}, []>>(
  start: S,
): S;

export function route<const S extends Route<string, {}, []>, A>(
  start: S,
  sa: (value: S) => A,
): A;

export function route<const S extends Route<string, {}, []>, A, B>(
  start: S,
  sa: (value: S) => A,
  ab: (value: A) => B,
): B;

export function route<const S extends Route<string, {}, []>, A, B, C>(
  start: S,
  sa: (value: S) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
): C;

export function route<const S extends Route<string, {}, []>, A, B, C, D>(
  start: S,
  sa: (value: S) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
): D;

export function route<const S extends Route<string, {}, []>, A, B, C, D, E>(
  start: S,
  sa: (value: S) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
): E;

export function route<const S extends Route<string, {}, []>, A, B, C, D, E, F>(
  start: S,
  sa: (value: S) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
): F;

export function route<
  const S extends Route<string, {}, []>,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
>(
  start: S,
  sa: (value: S) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
): G;

export function route<
  const S extends Route<string, {}, []>,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
>(
  start: S,
  sa: (value: S) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
): H;

export function route<
  const S extends Route<string, {}, []>,
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
  start: S,
  sa: (value: S) => A,
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
  start: Route<string, {}, []>,
  ...elements: readonly ((value: never) => unknown)[]
): unknown {
  return elements.reduce<unknown>(
    (value, element) => element(value as never),
    start,
  );
}

export function name<N extends string>(name: N): Route<N, {}, []> {
  return { name, params: {}, children: [] };
}

export function option<const K extends string, T>(
  key: K,
  schema: Schema<T>,
): <R extends AnyRoute>(
  route: R,
) => Route<
  R["name"],
  {
    [P in keyof ({ [Q in K]: T } & Model<R>)]: ({ [Q in K]: T } & Model<R>)[P];
  },
  R["children"]
> {
  type Added = { [Q in K]: T };

  return <R extends AnyRoute>(route: R) => {
    type Output = {
      [P in keyof (Added & Model<R>)]: (Added & Model<R>)[P];
    };

    return {
      ...route,
      params: {
        ...route.params,
        [key]: { key, schema },
      } as Route<R["name"], Output, R["children"]>["params"],
    };
  };
}

export function version(
  semver: string,
): <const R extends AnyRoute>(route: R) => R {
  return (route) => ({
    ...route,
    version: semver,
  });
}

type Model<R extends AnyRoute> = R extends
  Route<string, infer T, readonly AnyRoute[]> ? T
  : never;

// export function routes<const TChildren extends Route<string, object>(...children: TChildren): <const R extends Route<string, object>>(route: R) => R {
//   return (route) => {
//     return {
//       ....route,
//       children: route.children.concat(children),
//     };
//   }
// }
