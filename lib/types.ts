import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Literal } from "./tokenize.ts";
import type { Param } from "./param.ts";
import type { Result } from "./result.ts";

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
  P extends AnyPhases,
> extends Definition<N> {
  readonly methods: readonly M[];
  readonly version?: string;
  readonly phases: P;
  readonly model?: T;
  readonly children?: C;
}

export type Parse<R extends AnyRoute> = Outcome<ParseAt<R, "/", {}>>;

export type Phase<
  Model extends object,
  Routes extends readonly AnyRoute[],
  Requirement = never,
> = [Requirement] extends [never] ? Done<Model, Routes>
  : Next<Model, Routes, Requirement>;

export type Next<
  Model extends object,
  Routes extends readonly AnyRoute[],
  T,
> = {
  readonly params: Params<Model>;
  readonly routes: Routes;
  readonly resolver: (
    requirement: T,
  ) => (input: AnyRoute) => AnyRoute;
};

export type Done<
  Model extends object,
  Routes extends readonly AnyRoute[],
> = {
  readonly params: Params<Model>;
  readonly routes: Routes;
};

export type Params<Model extends object> = {
  [K in keyof Model]: K extends string ? Param<K, Model[K]> : never;
};

export interface ParseIncrement<
  R extends AnyRoute,
  P extends RoutePath = "/",
  Models extends ModelsByRoute = {},
> {
  readonly ok: true;
  readonly route: P;
  readonly model: IncrementModelOf<R>;

  resume(
    result: Result<RequirementOf<R>>,
  ): Outcome<ParseAt<ContinuationOf<R>, P, Models>>;
}

export type ContinuationOf<R extends AnyRoute> = R extends Route<
  string,
  Method,
  object,
  readonly AnyRoute[],
  readonly [
    AnyPhase,
    infer Next extends AnyPhase,
    ...infer Tail extends AnyPhase[],
  ]
> ? Route<
    R["name"],
    R["methods"][number],
    ModelOf<R>,
    ChildrenOf<R>,
    readonly [Next, ...Tail]
  >
  : never;

export type ModelOf<R extends AnyRoute> = R extends Route<
  string,
  Method,
  infer T,
  readonly AnyRoute[],
  readonly [AnyPhase, ...readonly AnyPhase[]]
> ? T
  : never;

export type ChildrenOf<R extends AnyRoute> = R extends
  Route<string, Method, object, infer Children, AnyPhases> ? Children
  : never;

export type RequirementsOf<R extends AnyRoute> = RequirementsIn<R["phases"]>;

export type RequirementOf<R extends AnyRoute> = RequirementIn<R["phases"][0]>;

export interface AnyRoute extends Definition<string> {
  readonly methods: readonly Method[];
  readonly version?: string;
  readonly phases: AnyPhases;
}

export interface AnyPhase {
  readonly params: Params<object>;
  readonly routes: readonly AnyRoute[];
  readonly resolver?: (requirement: never) => (route: never) => AnyRoute;
}

export type AnyPhases = readonly [AnyPhase, ...AnyPhase[]];

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

type RequirementIn<P extends AnyPhase> = P extends {
  readonly resolver: (
    requirement: infer Requirement,
  ) => (route: AnyRoute) => AnyRoute;
} ? Requirement
  : never;

type IncrementModelOf<R extends AnyRoute> = R["phases"][0] extends Next<
  infer Model,
  readonly AnyRoute[],
  unknown
> ? Model
  : never;

type ParseAt<
  R extends AnyRoute,
  P extends RoutePath,
  Models extends ModelsByRoute,
> = [RequirementOf<R>] extends [never] ? (
    | RouteIntents<R, P, AddModel<Models, P, ModelOf<R>>>
    | ParseChildren<
      ChildrenOf<R>,
      P,
      AddModel<Models, P, ModelOf<R>>
    >
  )
  : ParseIncrement<R, P, Models>;

type ParseChildren<
  C extends readonly AnyRoute[],
  P extends RoutePath,
  Models extends ModelsByRoute,
> = C extends readonly [
  infer Head extends AnyRoute,
  ...infer Tail extends readonly AnyRoute[],
] ? (
    | ParseAt<Head, Append<P, Head["name"]>, Models>
    | ParseChildren<Tail, P, Models>
  )
  : never;

type RequirementsIn<P extends readonly AnyPhase[]> = P extends readonly [
  infer Head extends AnyPhase,
  ...infer Tail extends AnyPhase[],
] ? [RequirementIn<Head>] extends [never] ? readonly []
  : readonly [RequirementIn<Head>, ...RequirementsIn<Tail>]
  : readonly [];

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

type AddParam<
  P extends AnyPhase,
  K extends string,
  V,
> = P extends Next<
  infer Model,
  infer Routes,
  infer Requirement
> ? Next<
    {
      [Key in keyof ({ [Added in K]: V } & Model)]: (
        { [Added in K]: V } & Model
      )[Key];
    },
    Routes,
    Requirement
  >
  : P extends Done<infer Model, infer Routes> ? Done<
      {
        [Key in keyof ({ [Added in K]: V } & Model)]: (
          { [Added in K]: V } & Model
        )[Key];
      },
      Routes
    >
  : never;

export type AddParamToLast<
  P extends AnyPhases,
  K extends string,
  V,
> = ReplaceLast<
  P,
  AddParam<LastOf<P>, K, V>
>;

export type AddRoutesToLast<
  P extends AnyPhases,
  C extends readonly AnyRoute[],
> = ReplaceLast<
  P,
  AddRoutes<LastOf<P>, C>
>;

type LastOf<P extends AnyPhases> = P extends readonly [
  ...AnyPhase[],
  infer Last extends AnyPhase,
] ? Last
  : never;

type ReplaceLast<
  P extends AnyPhases,
  Last extends AnyPhase,
> = P extends readonly [AnyPhase] ? readonly [Last]
  : P extends readonly [
    infer First extends AnyPhase,
    ...infer Middle extends AnyPhase[],
    AnyPhase,
  ] ? readonly [First, ...Middle, Last]
  : never;

type AddRoutes<
  Phase extends AnyPhase,
  Added extends readonly AnyRoute[],
> = Phase extends Next<
  infer Model,
  infer Routes,
  infer Requirement
> ? Next<
    Model,
    readonly [...Routes, ...Added],
    Requirement
  >
  : Phase extends Done<infer Model, infer Routes> ? Done<
      Model,
      readonly [...Routes, ...Added]
    >
  : never;

export type AddField<T extends object, K extends string, V> = {
  [P in keyof ({ [Q in K]: V } & T)]: (
    { [Q in K]: V } & T
  )[P];
};

type IntentsAt<
  R extends AnyRoute,
  P extends RoutePath,
  Models extends ModelsByRoute,
> =
  | RouteIntents<R, P, AddModel<Models, P, ModelOf<R>>>
  | ChildIntents<ChildrenOf<R>, P, AddModel<Models, P, ModelOf<R>>>;

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
