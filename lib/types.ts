import type { StandardSchemaV1 } from "@standard-schema/spec";

export type Issue = StandardSchemaV1.Issue;
export type Schema<T> = StandardSchemaV1<T, T>;

export interface Route<
  N extends string,
  T extends object,
  C extends readonly AnyRoute[],
> {
  readonly name: N;
  readonly version?: string;
  readonly params: {
    [K in keyof T]: K extends string ? Param<K, T[K]> : never;
  };
  readonly children: C;
}

export interface AnyRoute {
  readonly name: string;
  readonly version?: string;
  readonly params: Readonly<Record<string, Param<string, unknown>>>;
  readonly children: readonly AnyRoute[];
}

export type Method = "help" | "version" | "execute";

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

export type Result<T> = T | Failure<Status>;

export type Resolve<R extends AnyRoute, P extends Path> =
  | Help<R, P>
  | Version<R, P>
  | Execute<R, P>;

export type Help<R extends AnyRoute, P extends Path> = {
  readonly ok: true;
  readonly type: "help";
  readonly route: R;
  readonly path: P;
};

export type Version<R extends AnyRoute, P extends Path> = {
  readonly ok: true;
  readonly type: "version";
  readonly route: R;
  readonly path: P;
};

export type Execute<R extends AnyRoute, P extends Path> = {
  readonly ok: true;
  readonly type: "execute";
  readonly route: R;
  readonly path: P;
};

export type Status =
  | "route-not-found"
  | "method-not-allowed"
  | "unprocessable-content";

export interface NotFound extends Failure<"route-not-found"> {}

export interface MethodNotAllound<R extends AnyRoute>
  extends Failure<"method-not-allowed"> {
  route: R;
  allowed: Method[];
}

export interface UnprocessableContent<R extends AnyRoute>
  extends Failure<"unprocessable-content"> {
  route: R;
  issues: Issue[];
}
