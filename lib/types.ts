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
export type ModelSchema<T extends object> = Schema<unknown, T>;

export type Method = "help" | "version" | "execute";
export type Path = readonly string[];
export type RoutePath = `/${string}`;

export interface Definition<N extends string = string> {
  readonly name: N;
  readonly description?: string;
}

export type Params<Model extends object> = {
  [K in keyof Model]: K extends string ? Param<K, Model[K]> : never;
};

export type ModelParams = Params<Record<string, unknown>>;

export interface ModelTransformContext<
  Options extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly options: Options;
  readonly phase: ModelParams;
  readonly addIssue: (issue: Issue) => void;
}

export type ModelTransformFunction<
  Options extends Record<string, unknown> = Record<string, unknown>,
> = (context: ModelTransformContext<Options>) =>
  | Record<string, unknown>
  | void;

export type ModelTransform =
  | ModelSchema<object>
  | ModelTransformFunction;

export interface ModelOperation {
  readonly transform: ModelTransform;
  readonly keys: readonly string[];
  readonly deps?: readonly ModelOperation[];
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

  // These properties are type projections of the runtime route. They are
  // optional so the value remains the plain route object built at runtime.
  readonly model?: T;
  readonly children?: C;
}

export type Phase<
  Model extends object,
  Routes extends readonly AnyRoute[],
  Requirement = never,
> = [Requirement] extends [never] ? Done<Model, Routes>
  : Next<Model, Routes, Requirement>;

export interface Done<
  Model extends object,
  Routes extends readonly AnyRoute[],
> {
  readonly params: Params<Model>;
  readonly routes: Routes;
  readonly values: readonly ValueSource[];
  readonly envs: readonly EnvSource[];
  readonly transforms?: readonly ModelOperation[];
}

export interface Next<
  Model extends object,
  Routes extends readonly AnyRoute[],
  Requirement,
> extends Done<Model, Routes> {
  readonly resolver: (
    requirement: Requirement,
  ) => (route: AnyRoute) => AnyRoute;
}

export interface AnyPhase {
  readonly params: ModelParams;
  readonly routes: readonly AnyRoute[];
  readonly values: readonly ValueSource[];
  readonly envs: readonly EnvSource[];
  readonly transforms?: readonly ModelOperation[];
  readonly resolver?: (
    requirement: never,
  ) => (route: never) => AnyRoute;
}

export type AnyPhases = readonly [AnyPhase, ...AnyPhase[]];

export interface AnyRoute extends Definition<string> {
  readonly methods: readonly Method[];
  readonly version?: string;
  readonly phases: AnyPhases;
}

export type MethodsOf<R extends AnyRoute> = R["methods"][number];

export type ModelOf<R extends AnyRoute> = R extends Route<
  string,
  Method,
  infer Model,
  readonly AnyRoute[],
  AnyPhases
> ? Model
  : never;

export type ChildrenOf<R extends AnyRoute> = R extends Route<
  string,
  Method,
  object,
  infer Children,
  AnyPhases
> ? Children
  : never;

export type RequirementOf<R extends AnyRoute> = RequirementAt<
  R["phases"][0]
>;

export type RequirementsOf<R extends AnyRoute> = RequirementsAt<R["phases"]>;

export type ContinuationOf<R extends AnyRoute> = R extends Route<
  infer N,
  infer M,
  infer Model,
  infer Children,
  readonly [
    AnyPhase,
    infer Head extends AnyPhase,
    ...infer Tail extends AnyPhase[],
  ]
> ? Route<N, M, Model, Children, readonly [Head, ...Tail]>
  : never;

export interface ParseIncrement<
  R extends AnyRoute,
  P extends RoutePath = "/",
  Models extends ModelsByRoute = {},
> {
  readonly ok: true;
  readonly route: P;
  readonly model: PhaseModel<R["phases"][0]>;
  resume(
    result: Result<RequirementOf<R>>,
  ): Outcome<ParseAt<ContinuationOf<R>, P, Models>>;
}

export type Input = {
  readonly argv: string[];
  readonly values?: readonly ValueSource[];
  readonly envs?: readonly EnvSource[];
};

export interface Intent<
  M extends Method,
  P extends RoutePath,
  R extends AnyRoute = AnyRoute,
> {
  readonly ok: true;
  readonly method: M;
  readonly route: P;
  readonly definition: R;
  readonly path: PathOf<P>;
  readonly literals: Iterable<Literal>;
}

export type Help<
  P extends RoutePath,
  R extends AnyRoute = AnyRoute,
> = Intent<"help", P, R>;
export type Version<
  P extends RoutePath,
  R extends AnyRoute = AnyRoute,
> = Intent<"version", P, R>;

export type ModelsByRoute = {
  readonly [path: RoutePath]: object;
};

export interface Execute<
  P extends RoutePath,
  Models extends ModelsByRoute,
  R extends AnyRoute = AnyRoute,
> extends Intent<"execute", P, R> {
  readonly issues: readonly Issue[];
  readonly model: Models[P];
  readonly models: Models;
}

export type AnyIntent =
  | Help<RoutePath>
  | Version<RoutePath>
  | Execute<RoutePath, ModelsByRoute>;

export type Status = "method-not-allowed" | "unprocessable-content";

export interface Failure<C extends Status> {
  readonly ok: false;
  readonly code: C;
}

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

export type Outcome<T> = T | MethodNotAllowed | UnprocessableContent;

export type Parse<R extends AnyRoute> = Outcome<ParseAt<R, "/", {}>>;
export type IntentsOf<R extends AnyRoute> = ReachableIntents<R, "/", {}>;

export type PathOf<P extends RoutePath> = P extends "/" ? []
  : P extends `/${infer Rest}` ? SplitPath<Rest>
  : never;

export type AddParamToPhase<
  P extends AnyPhases,
  K extends string,
  V,
> = ReplaceLast<P, SetParam<Last<P>, K, V>>;

export type AddRoutesToPhase<
  P extends AnyPhases,
  C extends readonly AnyRoute[],
> = ReplaceLast<P, AppendRoutes<Last<P>, C>>;

export type SetField<T extends object, K extends string, V> = Simplify<
  { [P in keyof T | K]: P extends K ? V : P extends keyof T ? T[P] : never }
>;

type RequirementAt<P extends AnyPhase> = P extends {
  readonly resolver: (
    requirement: infer Requirement,
  ) => (route: AnyRoute) => AnyRoute;
} ? Requirement
  : never;

type RequirementsAt<P extends readonly AnyPhase[]> = P extends readonly [
  infer Head extends AnyPhase,
  ...infer Tail extends AnyPhase[],
] ? [RequirementAt<Head>] extends [never] ? readonly []
  : readonly [RequirementAt<Head>, ...RequirementsAt<Tail>]
  : readonly [];

type PhaseModel<P extends AnyPhase> = P extends Done<
  infer Model,
  readonly AnyRoute[]
> ? { [K in keyof Model]: Model[K] }
  : object;

type ParseAt<
  R extends AnyRoute,
  P extends RoutePath,
  Models extends ModelsByRoute,
> = [RequirementOf<R>] extends [never] ?
    | IntentsAt<R, P, Models>
    | ChildParses<
      ChildrenOf<R>,
      P,
      AddModel<
        Models,
        P,
        ModelOf<R>
      >
    >
  : ParseIncrement<R, P, MaterializeModels<Models>>;

type IntentsAt<
  R extends AnyRoute,
  P extends RoutePath,
  Models extends ModelsByRoute,
> =
  | Help<P, R>
  | ("version" extends MethodsOf<R> ? Version<P, R> : never)
  | ("execute" extends MethodsOf<R> ? Execute<
      P,
      MaterializeModels<AddModel<Models, P, ModelOf<R>>>,
      R
    >
    : never);

type ReachableIntents<
  R extends AnyRoute,
  P extends RoutePath,
  Models extends ModelsByRoute,
> =
  | IntentsAt<R, P, Models>
  | ReachableChildren<
    ChildrenOf<R>,
    P,
    AddModel<Models, P, ModelOf<R>>
  >;

type ReachableChildren<
  C extends readonly AnyRoute[],
  P extends RoutePath,
  Models extends ModelsByRoute,
> = C extends readonly [
  infer Head extends AnyRoute,
  ...infer Tail extends AnyRoute[],
] ?
    | ReachableIntents<Head, AppendPath<P, Head["name"]>, Models>
    | ReachableChildren<Tail, P, Models>
  : never;

type ChildParses<
  C extends readonly AnyRoute[],
  P extends RoutePath,
  Models extends ModelsByRoute,
> = C extends readonly [
  infer Head extends AnyRoute,
  ...infer Tail extends AnyRoute[],
] ?
    | ParseAt<Head, AppendPath<P, Head["name"]>, Models>
    | ChildParses<Tail, P, Models>
  : never;

type AddModel<
  Models extends ModelsByRoute,
  P extends RoutePath,
  Model extends object,
> = Simplify<{ [K in keyof Models | P]: K extends P ? Model : Models[K] }>;

type MaterializeModels<Models extends ModelsByRoute> = {
  [K in keyof Models]: { [P in keyof Models[K]]: Models[K][P] };
};

type SplitPath<S extends string> = string extends S ? Path
  : S extends `${infer Head}/${infer Tail}` ? [Head, ...SplitPath<Tail>]
  : S extends "" ? []
  : [S];

type AppendPath<P extends RoutePath, N extends string> = P extends "/" ? `/${N}`
  : `${P}/${N}`;

type SetParam<
  P extends AnyPhase,
  K extends string,
  V,
> = P extends Next<infer Model, infer Routes, infer Requirement>
  ? Next<SetField<Model, K, V>, Routes, Requirement>
  : P extends Done<infer Model, infer Routes>
    ? Done<SetField<Model, K, V>, Routes>
  : never;

type AppendRoutes<
  P extends AnyPhase,
  C extends readonly AnyRoute[],
> = P extends Next<infer Model, infer Routes, infer Requirement>
  ? Next<Model, readonly [...Routes, ...C], Requirement>
  : P extends Done<infer Model, infer Routes>
    ? Done<Model, readonly [...Routes, ...C]>
  : never;

type Last<P extends AnyPhases> = P extends readonly [
  ...AnyPhase[],
  infer Tail extends AnyPhase,
] ? Tail
  : never;

type ReplaceLast<
  P extends AnyPhases,
  Tail extends AnyPhase,
> = P extends readonly [AnyPhase] ? readonly [Tail]
  : P extends readonly [
    infer Head extends AnyPhase,
    ...infer Middle extends AnyPhase[],
    AnyPhase,
  ] ? readonly [Head, ...Middle, Tail]
  : never;

type Simplify<T> = { [K in keyof T]: T[K] };
