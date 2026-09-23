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

export type Outcome<T> = T | MethodNotAllowed | UnprocessableContent;

export type IntentsOf<R extends AnyRoute> = IntentsAt<R, `/`, {}>;

export type RoutePath = `/${string}`;

export type ModelsByRoute = {
  readonly [path: RoutePath]: object;
};

export type PathOf<R extends RoutePath> = R extends "/" ? []
  : R extends `/${infer Rest}` ? Split<Rest>
  : never;

export type AnyIntent =
  | Help<AnyRoute, RoutePath>
  | Version<AnyRoute, RoutePath>
  | Execute<AnyRoute, RoutePath, ModelsByRoute>;

export type ChildIntents<
  C extends readonly AnyRoute[],
  P extends RoutePath,
  T extends ModelsByRoute,
> = C extends readonly [
  infer Head extends AnyRoute,
  ...infer Tail extends readonly AnyRoute[],
] ? (
    | IntentsAt<Head, Append<P, Head["name"]>, T>
    | ChildIntents<Tail, P, T>
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
  Models extends ModelsByRoute,
> extends Intent<"execute", R, P> {
  readonly issues: readonly Issue[];
  readonly model: Models[P];
  readonly models: Models;
}

export type Status =
  | "method-not-allowed"
  | "unprocessable-content";

export interface MethodNotAllowed extends Failure<"method-not-allowed"> {
  readonly route: string;
  readonly definition: AnyRoute;
  readonly path: Path;
  readonly method: Method;
  readonly allowed: readonly Method[];
}

export interface UnprocessableContent extends Failure<"unprocessable-content"> {
  readonly route: string;
  readonly definition: AnyRoute;
  readonly path: Path;
  readonly issues: Issue[];
}

type AddModel<
  M extends ModelsByRoute,
  P extends RoutePath,
  T extends object,
> = {
  [K in keyof M | P]: K extends P ? T : K extends keyof M ? M[K] : never;
};

type Split<S extends string> = string extends S ? Path
  : S extends `${infer Head}/${infer Tail}` ? [Head, ...Split<Tail>]
  : S extends "" ? []
  : [S];

type Append<
  A extends RoutePath,
  N extends string,
> = A extends "/" ? `/${N}`
  : `${A}/${N}`;

type IntentsAt<
  R extends AnyRoute,
  P extends RoutePath,
  Models extends ModelsByRoute,
> =
  | RouteIntents<R, P, AddModel<Models, P, ModelOf<R>>>
  | ChildIntents<R["children"], P, AddModel<Models, P, ModelOf<R>>>;

type RouteIntents<
  R extends AnyRoute,
  P extends RoutePath,
  T extends ModelsByRoute,
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
