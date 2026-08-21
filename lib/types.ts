// deno-lint-ignore-file ban-types
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Literal } from "./tokenize.ts";
import type { Param } from "./param.ts";

export type Issue = StandardSchemaV1.Issue;
export type Schema<T> = StandardSchemaV1<T, T>;

export interface Definition<N extends string> {
  readonly name: N;
  readonly description?: string;
}

export interface Route<
  N extends string,
  M extends Method,
  T extends object,
  C extends readonly AnyRoute[],
> extends Definition<N> {
  readonly methods: readonly M[];
  readonly version?: string;
  readonly params: {
    [K in keyof T]: K extends string ? Param<K, T[K]> : never;
  };
  readonly children: C;
}

export type ModelOf<R extends AnyRoute> = R extends
  Route<string, Method, infer T, readonly AnyRoute[]> ? T
  : never;

export interface AnyRoute extends Definition<string> {
  readonly methods: readonly Method[];
  readonly version?: string;
  readonly params: Readonly<Record<string, Param<string, unknown>>>;
  readonly children: readonly AnyRoute[];
}

export type Method = "help" | "version" | "execute";
export type MethodsOf<R extends AnyRoute> = R["methods"][number];

export type Path = readonly string[];

export type Input = {
  argv: string[];
};

export interface Failure<C extends Status> {
  readonly ok: false;
  readonly code: C;
}

export type Parse<T> = T | MethodNotAllowed | UnprocessableContent;

export type Resolve<R extends AnyRoute> = ResolveAt<R, `/`, {}>;

export type RoutePath = `/${string}`;

export type RouteMap = {
  readonly [path: RoutePath]: object;
};

export type AppendRouteModel<
  C extends RouteMap,
  P extends RoutePath,
  T extends object,
> = {
  [K in keyof C | P]: K extends P ? T : K extends keyof C ? C[K] : never;
};

export type PathOf<R extends RoutePath> = R extends "/" ? []
  : R extends `/${infer Rest}` ? Split<Rest>
  : never;

type Split<S extends string> = string extends S ? Path
  : S extends `${infer Head}/${infer Tail}` ? [Head, ...Split<Tail>]
  : S extends "" ? []
  : [S];

type Append<
  A extends RoutePath,
  N extends string,
> = A extends "/" ? `/${N}`
  : `${A}/${N}`;

type ResolveAt<
  R extends AnyRoute,
  P extends RoutePath,
  T extends RouteMap,
> =
  | ResolveRoute<R, P, AppendRouteModel<T, P, ModelOf<R>>>
  | ResolveChildren<R["children"], P, AppendRouteModel<T, P, ModelOf<R>>>;

type ResolveRoute<
  R extends AnyRoute,
  P extends RoutePath,
  T extends RouteMap,
> =
  | Help<R, P>
  | (
    "version" extends MethodsOf<R> ? Version<R, P>
      : never
  )
  | (
    "execute" extends MethodsOf<R> ? Execute<R, P, T>
      : never
  );

export type AnyResolve =
  | Help<AnyRoute, RoutePath>
  | Version<AnyRoute, RoutePath>
  | Execute<AnyRoute, RoutePath, RouteMap>;

type ResolveChildren<
  C extends readonly AnyRoute[],
  P extends RoutePath,
  T extends RouteMap,
> = C extends readonly [
  infer Head extends AnyRoute,
  ...infer Tail extends readonly AnyRoute[],
] ? (
    | ResolveAt<Head, Append<P, Head["name"]>, T>
    | ResolveChildren<Tail, P, T>
  )
  : never;

export interface Intent<
  M extends Method,
  R extends AnyRoute,
  P extends RoutePath,
> {
  readonly ok: true;
  readonly method: M;
  readonly route: P;
  readonly definition: R;
  readonly path: PathOf<P>;
  readonly literals: Iterable<Literal>;
}

export type Help<R extends AnyRoute, P extends RoutePath> = Intent<
  "help",
  R,
  P
>;

export type Version<R extends AnyRoute, P extends RoutePath> = Intent<
  "version",
  R,
  P
>;

export interface Execute<
  R extends AnyRoute,
  P extends RoutePath,
  C extends RouteMap,
> extends
  Intent<
    "execute",
    R,
    P
  > {
  readonly issues: readonly Issue[];
  readonly model: C[P];
  readonly models: C;
}

export type Status =
  | "method-not-allowed"
  | "unprocessable-content";

export interface MethodNotAllowed extends Failure<"method-not-allowed"> {
  readonly route: AnyRoute;
  readonly path: Path;
  readonly method: Method;
  readonly allowed: readonly Method[];
}

export interface UnprocessableContent extends Failure<"unprocessable-content"> {
  readonly route: AnyRoute;
  readonly path: Path;
  readonly issues: Issue[];
}
