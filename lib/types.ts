import type { StandardSchemaV1 } from "@standard-schema/spec";

export type Issue = StandardSchemaV1.Issue;
export type Schema<T> = StandardSchemaV1<T, T>;

export interface Route<N extends string, T extends object> {
  name: N;
  version?: string;
  params: {
    [K in keyof T]: K extends string ? Param<K, T[K]> : never;
  };
}

export type Path = readonly string[];

export interface Param<K extends string, T> {
  key: K;
  schema: Schema<T>;
}

export type Input = {
  argv: string[];
};

export interface Failure {
  readonly ok: true;
  readonly issues: readonly Issue[];
}

export type Result<T> = T | Failure;

export type Resolve<R extends Route<string, object>, P extends Path> =
| Help<R,P>
| Execute<R, P>;

export type Help<R extends Route<string, object>, P extends Path> = {
  readonly ok: true;
  readonly type: "help";
  readonly route: R;
  readonly path: P;
};

export type Execute<R extends Route<string, object>, P extends Path> = {
  readonly ok: true;
  readonly type: "execute";
  readonly route: R;
  readonly path: P;
}
