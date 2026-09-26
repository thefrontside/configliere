import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { EnvSource } from "./env.ts";
import type { Literal } from "./tokenize.ts";
import type { Param } from "./param.ts";
import type { Result } from "./result.ts";
import type { ValueSource } from "./values.ts";

export type Issue = StandardSchemaV1.Issue;
export type Schema<Input = unknown, Output = Input> = StandardSchemaV1<
  Input,
  Output
>;
export type OutputOf<S extends Schema> = StandardSchemaV1.InferOutput<S>;

export interface Definition<N extends string> {
  readonly name: N;
  readonly description?: string;
}

export interface Route<
  N extends string,
  M extends Method,
  P extends AnyPhases,
> extends Definition<N> {
  readonly methods: readonly M[];
  readonly version?: string;
  readonly phases: P;
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
  readonly [phaseModel]?: Model;
  readonly model: {
    params: Params;
    steps: ((previous: object, bindings: Record<string, unknown>) => Result<object>)[];
  }
  readonly routes: Routes;
  readonly values: readonly ValueSource[];
  readonly envs: readonly EnvSource[];
  readonly resolver: (
    requirement: T,
  ) => (input: AnyRoute) => AnyRoute;
};

export type Done<
  Model extends object,
  Routes extends readonly AnyRoute[],
> = {
  readonly [phaseModel]?: Model;
  readonly model: {
    params: Params;
    steps: ((previous: object, bindings: Record<string, unknown>) => Result<object>)[];
  }
  readonly routes: Routes;
  readonly values: readonly ValueSource[];
  readonly envs: readonly EnvSource[];
};

export type Params = Readonly<Record<string, Param<string, unknown>>>;

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

export type ContinuationOf<R extends AnyRoute> = Route<
  R["name"],
  MethodsOf<R>,
  SettleNext<R["phases"]>
>;

export type ModelOf<
  R extends AnyRoute,
  P extends RoutePath = "/",
> = ModelOfRoute<RouteAt<R, P>>;

export type ChildrenOf<R extends AnyRoute> = RoutesIn<R["phases"]>;

export type RequirementsOf<R extends AnyRoute> = RequirementsIn<R["phases"]>;

export type RequirementOf<R extends AnyRoute> = RequirementInPhases<
  R["phases"]
>;

export interface AnyRoute extends Definition<string> {
  readonly methods: readonly Method[];
  readonly version?: string;
  readonly phases: AnyPhases;
}

export interface AnyPhase {
  readonly [phaseModel]?: object;
  readonly model: {
    params: Params;
    steps: ((previous: object, bindings: Record<string, unknown>) => Result<object>)[];
  };
  readonly routes: readonly AnyRoute[];
  readonly values: readonly ValueSource[];
  readonly envs: readonly EnvSource[];
  readonly resolver?: (requirement: never) => (route: never) => AnyRoute;
}

export type AnyPhases = readonly [AnyPhase, ...AnyPhase[]];

export type Method = "help" | "version" | "execute";
export type MethodsOf<R extends AnyRoute> = R["methods"][number];

export type Path = readonly string[];

export type Input = {
  argv: string[];
  values?: readonly ValueSource[];
  envs?: readonly EnvSource[];
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
  | Help<RoutePath>
  | Version<RoutePath>
  | Execute<RoutePath, ModelsByRoute>;

export type ChildIntents<
  C extends readonly AnyRoute[],
  P extends RoutePath,
  Models extends ModelsByRoute,
> = C extends readonly [
  infer Head extends AnyRoute,
  ...infer Tail extends readonly AnyRoute[],
] ? (
    | IntentsAt<Head, Append<P, Head["name"]>, Models>
    | ChildIntents<Tail, P, Models>
  )
  : never;

export interface Intent<
  M extends Method,
  P extends RoutePath,
> {
  readonly ok: true;
  readonly method: M;
  readonly route: P;
  readonly definition: AnyRoute;
  readonly path: PathOf<P>;
  readonly literals: Iterable<Literal>;
}

export type Help<P extends RoutePath> = Intent<
  "help",
  P
>;

export type Version<P extends RoutePath> = Intent<
  "version",
  P
>;

export interface Execute<
  P extends RoutePath,
  Models extends ModelsByRoute,
> extends Intent<"execute", P> {
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

declare const phaseModel: unique symbol;

type ModelOfRoute<R extends AnyRoute> = ModelsIn<R["phases"]> extends
  infer Model extends object ? { [K in keyof Model]: Model[K] }
  : never;

type ModelsIn<P extends readonly AnyPhase[]> = P extends readonly [
  infer Head extends AnyPhase,
  ...infer Tail extends readonly AnyPhase[],
] ? Omit<PhaseModelOf<Head>, ModelKeys<Tail>> & ModelsIn<Tail>
  : {};

type ModelKeys<P extends readonly AnyPhase[]> = P extends readonly [
  infer Head extends AnyPhase,
  ...infer Tail extends readonly AnyPhase[],
] ? keyof PhaseModelOf<Head> | ModelKeys<Tail>
  : never;

type PhaseModelOf<P extends AnyPhase> = P extends {
  readonly [phaseModel]?: infer Model extends object;
} ? Model
  : never;

type RoutesIn<P extends readonly AnyPhase[]> = P extends readonly [
  infer Head extends AnyPhase,
  ...infer Tail extends readonly AnyPhase[],
] ? readonly [...Head["routes"], ...RoutesIn<Tail>]
  : readonly [];

type RouteAt<
  R extends AnyRoute,
  P extends RoutePath,
> = P extends "/" ? R
  : P extends `/${infer Head}/${infer Tail}`
    ? FindRoute<ChildrenOf<R>, Head> extends infer Child extends AnyRoute
      ? RouteAt<Child, `/${Tail}`>
    : never
  : P extends `/${infer Name}` ? FindRoute<ChildrenOf<R>, Name>
  : never;

type FindRoute<
  C extends readonly AnyRoute[],
  N extends string,
> = C extends readonly [
  infer Head extends AnyRoute,
  ...infer Tail extends readonly AnyRoute[],
] ? Head["name"] extends N ? Head
  : FindRoute<Tail, N>
  : never;

type SettleNext<P extends AnyPhases> = P extends readonly [
  infer Head extends AnyPhase,
  ...infer Tail extends readonly AnyPhase[],
]
  ? Head extends Next<infer Model, infer Routes, infer _Requirement>
    ? readonly [Done<Model, Routes>, ...Tail]
  : Tail extends AnyPhases ? readonly [Head, ...SettleNext<Tail>]
  : P
  : never;

type NextModelIn<P extends readonly AnyPhase[]> = P extends readonly [
  infer Head extends AnyPhase,
  ...infer Tail extends readonly AnyPhase[],
] ? Head extends Next<
    infer Model,
    readonly AnyRoute[],
    infer _Requirement
  > ? Model
  : NextModelIn<Tail>
  : never;

type RequirementIn<P extends AnyPhase> = P extends {
  readonly resolver: (
    requirement: infer Requirement,
  ) => (route: AnyRoute) => AnyRoute;
} ? Requirement
  : never;

type RequirementInPhases<P extends readonly AnyPhase[]> = P extends readonly [
  infer Head extends AnyPhase,
  ...infer Tail extends readonly AnyPhase[],
] ? [RequirementIn<Head>] extends [never] ? RequirementInPhases<Tail>
  : RequirementIn<Head>
  : never;

type IncrementModelOf<R extends AnyRoute> = NextModelIn<R["phases"]>;

type ParseAt<
  R extends AnyRoute,
  P extends RoutePath,
  Models extends ModelsByRoute,
> = [RequirementOf<R>] extends [never] ? (
    | Help<P>
    | (
      "version" extends MethodsOf<R> ? Version<P>
        : never
    )
    | (
      "execute" extends MethodsOf<R> ? AddModel<
          Models,
          P,
          ModelOf<R>
        > extends infer Bound extends ModelsByRoute ? Execute<
            P,
            { [K in keyof Bound]: Bound[K] }
          >
        : never
        : never
    )
    | ParseChildren<
      ChildrenOf<R>,
      P,
      AddModel<Models, P, ModelOf<R>>
    >
  )
  : ParseIncrement<R, P, { [K in keyof Models]: Models[K] }>;

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
] ? [RequirementIn<Head>] extends [never] ? RequirementsIn<Tail>
  : readonly [RequirementIn<Head>, ...RequirementsIn<Tail>]
  : readonly [];

type AddModel<
  Models extends ModelsByRoute,
  P extends RoutePath,
  T extends object,
> = {
  [K in keyof Models | P]: K extends P ? T
    : K extends keyof Models ? Models[K]
    : never;
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

type IntentsAt<
  R extends AnyRoute,
  P extends RoutePath,
  Models extends ModelsByRoute,
> =
  | Help<P>
  | (
    "version" extends MethodsOf<R> ? Version<P>
      : never
  )
  | (
    "execute" extends MethodsOf<R> ? AddModel<
        Models,
        P,
        ModelOf<R>
      > extends infer Bound extends ModelsByRoute ? Execute<
          P,
          { [K in keyof Bound]: Bound[K] }
        >
      : never
      : never
  )
  | ChildIntents<
    ChildrenOf<R>,
    P,
    AddModel<Models, P, ModelOf<R>>
  >;
