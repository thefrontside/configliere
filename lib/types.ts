import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Literal } from "./tokenize.ts";

export type Issue = StandardSchemaV1.Issue;
export type Schema<T> = StandardSchemaV1<T, T>;

export interface Route<
  N extends string,
  M extends Method,
  T extends object,
  C extends readonly AnyRoute[],
> {
  readonly name: N;
  readonly methods: readonly M[];
  readonly version?: string;
  readonly params: {
    [K in keyof T]: K extends string ? Param<K, T[K]> : never;
  };
  readonly children: C;
}

export interface AnyRoute {
  readonly name: string;
  readonly methods: readonly Method[];
  readonly version?: string;
  readonly params: Readonly<Record<string, Param<string, unknown>>>;
  readonly children: readonly AnyRoute[];
}

export type Method = "help" | "version" | "execute";
export type MethodsOf<R extends AnyRoute> = R["methods"][number];

export type Path = readonly string[];

export interface Param<K extends string, T> {
  key: K;
  schema: Schema<T>;
}

export type Input = {
  argv: string[];
};

export interface Failure<C extends Status> {
  readonly ok: false;
  readonly code: C;
}

export type Result<T> = T | MethodNotAllowed | UnprocessableContent;

export type Resolve<R extends AnyRoute> = ResolveAt<R, `/`>;

export type RoutePath = `/${string}`;

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
> =
  | ResolveRoute<R, P>
  | ResolveChildren<R["children"], P>;

type ResolveRoute<
  R extends AnyRoute,
  P extends RoutePath,
> =
  | Help<R, P>
  | (
    "version" extends MethodsOf<R> ? Version<R, P>
      : never
  )
  | (
    "execute" extends MethodsOf<R> ? Execute<R, P>
      : never
  );

export type AnyResolve =
  | Help<AnyRoute, RoutePath>
  | Version<AnyRoute, RoutePath>
  | Execute<AnyRoute, RoutePath>;

type ResolveChildren<
  C extends readonly AnyRoute[],
  P extends RoutePath,
> = C extends readonly [
  infer Head extends AnyRoute,
  ...infer Tail extends readonly AnyRoute[],
] ? (
    | ResolveAt<Head, Append<P, Head["name"]>>
    | ResolveChildren<Tail, P>
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

export type Execute<R extends AnyRoute, P extends RoutePath> = Intent<
  "execute",
  R,
  P
>;

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
