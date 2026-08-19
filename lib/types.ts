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

export type Resolve<R extends AnyRoute> = ResolveAt<R, []>;

type ResolveAt<
  R extends AnyRoute,
  P extends Path,
> =
  | ResolveRoute<R, P>
  | ResolveChildren<R["children"], P>;

type ResolveRoute<
  R extends AnyRoute,
  P extends Path,
> =
  | Help<R, P>
  | (
    "version" extends MethodsOf<R>
      ? Version<R, P>
      : never
  )
  | (
    "execute" extends MethodsOf<R>
      ? Execute<R, P>
      : never
  );

export type AnyResolve =
  | Help<AnyRoute, Path>
  | Version<AnyRoute, Path>
  | Execute<AnyRoute, Path>;

type ResolveChildren<
  C extends readonly AnyRoute[],
  P extends Path,
> = C extends readonly [
  infer Head extends AnyRoute,
  ...infer Tail extends readonly AnyRoute[],
]
  ? (
    | ResolveAt<Head, [...P, Head["name"]]>
    | ResolveChildren<Tail, P>
  )
  : never;


export type Help<R extends AnyRoute, P extends Path> = {
  readonly ok: true;
  readonly type: "help";
  readonly route: R;
  readonly path: P;
  readonly literals: Iterable<Literal>;
};

export type Version<R extends AnyRoute, P extends Path> = {
  readonly ok: true;
  readonly type: "version";
  readonly route: R;
  readonly path: P;
  readonly literals: Iterable<Literal>;
};

export type Execute<R extends AnyRoute, P extends Path> = {
  readonly ok: true;
  readonly type: "execute";
  readonly route: R;
  readonly path: P;
  readonly literals: Iterable<Literal>;
};

export type Status =
  | "method-not-allowed"
  | "unprocessable-content";

export interface MethodNotAllowed
  extends Failure<"method-not-allowed"> {
    readonly route: AnyRoute;
    readonly path: Path;
    readonly method: Method;
    readonly allowed: readonly Method[];
}

export interface UnprocessableContent
  extends Failure<"unprocessable-content"> {
    readonly route: AnyRoute;
    readonly path: Path;
    readonly issues: Issue[];
}
