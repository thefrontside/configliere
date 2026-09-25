import type {
  AddRoutesToLast,
  AnyPhase,
  AnyPhases,
  AnyRoute,
  Done,
  Method,
  MethodsOf,
  Next,
  Phase,
  Route,
} from "./types.ts";

export type Element<D extends Delta> = {
  readonly [operation]: D;
};

export type AnyElement = Element<Delta>;

export type Unary = (value: never) => unknown;

export type AnyPipelineElement = Unary;

export interface Transform {
  readonly input: unknown;
  readonly output: unknown;
}

export type ApplyTransform<F extends Transform, S> = (
  F & { readonly input: S }
)["output"];

export interface ModelTransform extends Transform {
  readonly input: object;
  readonly output: object;
}

// We don’t need ModelPatch semantically. It is only a TypeScript
// performance marker. Additive transforms expose their fields only so
// static folds can batch them. ModelPatch exposes that additive field
// set so the fold can combine twenty parameter operations into one
// model update. Without it, every parameter must be applied as
// another higher-kinded transform. Even with five-item
// chunks and materializing after every step—and the 100-option tests
// hit TS2589: type instantiation is excessively deep.
export interface ModelPatch<Fields extends object> extends ModelTransform {
  readonly fields: Fields;
  readonly input: object;
  readonly output: ApplyModelPatch<this["input"], Fields>;
}

export type ApplyModelPatch<
  Model extends object,
  Fields extends object,
> = SimplifyModel<Omit<Model, keyof Fields> & Fields>;

export interface TransformElement<F extends Transform> {
  readonly [operation]: Custom<F>;

  <S extends F["input"]>(value: S): ApplyTransform<F, S>;
}

export interface ModelElement<F extends ModelTransform> {
  readonly [operation]: TransformModel<F>;

  <R extends AnyRoute>(route: R): Apply<R, TransformModel<F>>;
}

export interface IdentityElement<S> {
  readonly [operation]: Identity<S>;

  <T extends S>(value: T): T;
}

export interface MethodElement<Added extends Method> {
  readonly [operation]: AddMethod<Added>;

  <
    const N extends string,
    const M extends Method,
    const P extends AnyPhases,
  >(route: Route<N, M, P>): Route<N, M | Added, P>;
}

export interface RoutesElement<Added extends readonly AnyRoute[]> {
  readonly [operation]: AddRoutes<Added>;

  <
    const N extends string,
    const M extends Method,
    const P extends AnyPhases,
  >(route: Route<N, M, P>): Route<
    N,
    M,
    AddRoutesToLast<P, Added>
  >;
}

export type Extension<E extends readonly Unary[]> =
  & Element<Batch<E>>
  & (E extends readonly AnyElement[] ? GenericExtension<E>
    : ConcreteExtension<E>);

interface GenericExtension<E extends readonly Unary[]> {
  readonly [operation]: Batch<E>;

  <S extends InputOfPipeline<E>>(value: S): Fold<S, E>;
}

interface ConcreteExtension<E extends readonly Unary[]> {
  (
    value: [Fold<InputOfPipeline<E>, E>] extends [never] ? never
      : InputOfPipeline<E>,
  ): Fold<InputOfPipeline<E>, E>;
}

export interface DynamicElement<Requirement, E extends AnyElement> {
  readonly [operation]: Dynamic<Requirement, E>;

  <R extends AnyRoute>(route: R): Apply<R, Dynamic<Requirement, E>>;
}

export type Seed<R extends AnyRoute> = Route<
  R["name"],
  MethodsOf<R>,
  readonly [Phase<{}, [], never>]
>;

export type ConjoinPhases<
  A extends AnyRoute,
  B extends AnyRoute,
  Requirement,
> = ConcatPhases<
  ContinueLast<A["phases"], Requirement>,
  B["phases"]
>;

export type Fold<
  S,
  E extends readonly AnyPipelineElement[],
> = number extends E["length"] ? Conservative<S>
  : E extends readonly [
    infer Head extends AnyPipelineElement,
    ...infer Tail extends readonly AnyPipelineElement[],
  ] ? true extends IsUnion<Head> ? Conservative<S>
    : Head extends AnyElement
      ? S extends AnyRoute
        ? DeltaOf<Head> extends StaticDelta ? TakeStatic<E> extends readonly [
            infer Fields extends object,
            infer Routes extends readonly AnyRoute[],
            infer Methods extends Method,
            infer Rest extends readonly AnyPipelineElement[],
          ] ? Fold<WithStatic<S, Fields, Routes, Methods>, Rest>
          : never
        : Fold<Apply<S, DeltaOf<Head>>, Tail>
      : Fold<Apply<S, DeltaOf<Head>>, Tail>
    : Head extends (value: S) => infer Output ? Fold<Output, Tail>
    : never
  : S;

export type Materialize<S> = AnyRoute extends S ? S
  : S extends Route<
    infer N,
    infer M,
    infer Phases
  > ? WithExtras<
      Route<
        N,
        M,
        {
          [K in keyof Phases]: Phases[K] extends AnyPhase
            ? MaterializePhase<Phases[K]>
            : Phases[K];
        }
      >,
      S
    >
  : S;

export type Check<
  S,
  E extends readonly AnyPipelineElement[],
> = number extends E["length"] ? unknown
  : E extends readonly AnyElement[]
    ? [Fold<S, E>] extends [never] ? CheckMixed<S, E>
    : E
  : CheckMixed<S, E>;

export function mark<F extends Transform>(
  element: (value: never) => unknown,
): TransformElement<F> {
  return element as TransformElement<F>;
}

export function brand<E extends AnyElement>(element: unknown): E {
  return element as E;
}

declare const operation: unique symbol;

type Delta =
  | Identity<unknown>
  | AddMethod<Method>
  | TransformModel<ModelTransform>
  | AddRoutes<readonly AnyRoute[]>
  | Batch<readonly Unary[]>
  | Dynamic<unknown, AnyElement>
  | Custom<Transform>;

type StaticDelta =
  | Identity<unknown>
  | AddMethod<Method>
  | TransformModel<ModelPatch<object>>
  | AddRoutes<readonly AnyRoute[]>;

interface Identity<S> {
  readonly type: "identity";
  readonly input: S;
}

interface AddMethod<M extends Method> {
  readonly type: "method";
  readonly method: M;
}

interface TransformModel<F extends ModelTransform> {
  readonly type: "model";
  readonly transform: F;
}

interface AddRoutes<C extends readonly AnyRoute[]> {
  readonly type: "routes";
  readonly children: C;
}

interface Batch<E extends readonly Unary[]> {
  readonly type: "batch";
  readonly elements: E;
}

interface Dynamic<Requirement, E extends AnyElement> {
  readonly type: "dynamic";
  readonly requirement: Requirement;
  readonly element: E;
}

interface Custom<F extends Transform> {
  readonly type: "custom";
  readonly transform: F;
}

type Apply<S, D extends Delta> = Delta extends D ? Conservative<S>
  : D extends Identity<infer Input> ? S extends Input ? S : never
  : D extends AddMethod<infer M> ? S extends AnyRoute ? Route<
        S["name"],
        MethodsOf<S> | M,
        S["phases"]
      >
    : never
  : D extends TransformModel<infer F> ? S extends AnyRoute ? WithModel<S, F>
    : never
  : D extends AddRoutes<infer C> ? S extends AnyRoute ? Route<
        S["name"],
        MethodsOf<S>,
        AddRoutesToLast<S["phases"], C>
      >
    : never
  : D extends Batch<infer E> ? Fold<S, E>
  : D extends Dynamic<infer Requirement, infer E>
    ? S extends AnyRoute
      ? Apply<Seed<S>, DeltaOf<E>> extends infer After extends AnyRoute ? Route<
          After["name"],
          MethodsOf<After>,
          ConjoinPhases<S, After, Requirement>
        >
      : never
    : never
  : D extends Custom<infer F> ? S extends F["input"] ? ApplyTransform<F, S>
    : never
  : never;

type DeltaOf<E extends AnyElement> = E[typeof operation];

type IsUnion<T, Whole = T> = T extends unknown ? [Whole] extends [T] ? false
  : true
  : never;

type Conservative<S> = S extends AnyRoute ? AnyRoute : unknown;

type CheckMixed<
  S,
  E extends readonly AnyPipelineElement[],
> = E extends readonly [] ? E
  : E extends readonly [
    infer Head extends AnyPipelineElement,
    ...infer Tail extends readonly AnyPipelineElement[],
  ] ? [Fold<S, readonly [Head]>] extends [never] ? readonly [never, ...Tail]
    : readonly [Head, ...CheckTail<Fold<S, readonly [Head]>, Tail>]
  : never;

type CheckTail<
  S,
  E extends readonly AnyPipelineElement[],
> = number extends E["length"] ? E
  : E extends readonly AnyElement[] ? E
  : CheckMixed<S, E>;

type InputOf<E extends AnyPipelineElement> = E extends AnyElement
  ? InputOfDelta<DeltaOf<E>>
  : E extends (value: infer Input) => unknown ? Input
  : never;

type InputOfPipeline<E extends readonly AnyPipelineElement[]> = E extends
  readonly [
    infer Head extends AnyPipelineElement,
    ...readonly AnyPipelineElement[],
  ] ? InputOf<Head>
  : unknown;

type InputOfDelta<D extends Delta> = D extends Identity<infer Input> ? Input
  : D extends
    | AddMethod<Method>
    | TransformModel<ModelTransform>
    | AddRoutes<
      readonly AnyRoute[]
    >
    | Dynamic<unknown, AnyElement> ? AnyRoute
  : D extends Batch<infer E> ? InputOfPipeline<E>
  : D extends Custom<infer F> ? F["input"]
  : never;

// Bound each scan; Fold resumes with E, so this is not an element limit.
type TakeStatic<
  E extends readonly AnyPipelineElement[],
  Fields extends readonly object[] = readonly [],
  Routes extends readonly AnyRoute[] = readonly [],
  Methods extends Method = never,
  Count extends readonly unknown[] = readonly [],
> = Count["length"] extends 20
  ? readonly [MergeFields<Fields>, Routes, Methods, E]
  : E extends readonly [
    infer Head extends AnyElement,
    ...infer Tail extends readonly AnyPipelineElement[],
  ] ? DeltaOf<Head> extends Identity<unknown> ? TakeStatic<
        Tail,
        Fields,
        Routes,
        Methods,
        readonly [...Count, unknown]
      >
    : DeltaOf<Head> extends AddMethod<infer M> ? TakeStatic<
        Tail,
        Fields,
        Routes,
        Methods | M,
        readonly [...Count, unknown]
      >
    : DeltaOf<Head> extends TransformModel<ModelPatch<infer Added>>
      ? TakeStatic<
        Tail,
        readonly [...Fields, Added],
        Routes,
        Methods,
        readonly [...Count, unknown]
      >
    : DeltaOf<Head> extends AddRoutes<infer C> ? TakeStatic<
        Tail,
        Fields,
        readonly [...Routes, ...C],
        Methods,
        readonly [...Count, unknown]
      >
    : readonly [MergeFields<Fields>, Routes, Methods, E]
  : readonly [MergeFields<Fields>, Routes, Methods, E];

type MergeFields<F extends readonly object[]> = {
  [K in FieldKeys<F>]: FieldValue<F, K>;
};

type FieldKeys<F extends readonly object[]> = F extends readonly [
  infer Head extends object,
  ...infer Tail extends readonly object[],
] ? keyof Head | FieldKeys<Tail>
  : never;

type FieldValue<
  F extends readonly object[],
  K extends PropertyKey,
> = F extends readonly [
  ...infer Rest extends readonly object[],
  infer Last extends object,
] ? K extends keyof Last ? Last[K] : FieldValue<Rest, K>
  : never;

type WithModel<
  R extends AnyRoute,
  F extends ModelTransform,
> = ApplyModel<PhaseModel<Last<R["phases"]>>, F> extends infer Model
  ? [Model] extends [never] ? never
  : Model extends object ? Route<
      R["name"],
      MethodsOf<R>,
      ReplaceLastModel<R["phases"], MaterializeModel<Model>>
    >
  : never
  : never;

type WithStatic<
  R extends AnyRoute,
  Fields extends object,
  Routes extends readonly AnyRoute[],
  Methods extends Method,
> = Route<
  R["name"],
  MethodsOf<R> | Methods,
  AddStaticToLast<R["phases"], Fields, Routes>
>;

type AddStaticToLast<
  P extends AnyPhases,
  Fields extends object,
  Routes extends readonly AnyRoute[],
> = keyof Fields extends never ? Routes extends readonly [] ? P
  : AddRoutesToLast<P, Routes>
  : Routes extends readonly [] ? AddFieldsToLast<P, Fields>
  : AddRoutesToLast<AddFieldsToLast<P, Fields>, Routes>;

type AddFieldsToLast<
  P extends AnyPhases,
  Fields extends object,
> = ReplaceLastModel<P, AddFields<PhaseModel<Last<P>>, Fields>>;

type AddFields<Model extends object, Fields extends object> = ApplyModelPatch<
  Model,
  Fields
>;

type ReplaceLastModel<
  P extends AnyPhases,
  Model extends object,
> = P extends readonly [infer Only extends AnyPhase]
  ? readonly [WithPhaseModel<Only, Model>]
  : P extends readonly [
    infer First extends AnyPhase,
    ...infer Middle extends AnyPhase[],
    AnyPhase,
  ] ? readonly [First, ...Middle, WithPhaseModel<Last<P>, Model>]
  : never;

type WithPhaseModel<P extends AnyPhase, Model extends object> = P extends Next<
  infer _Current,
  infer Routes,
  infer Requirement
> ? Next<Model, Routes, Requirement>
  : P extends Done<infer _Current, infer Routes> ? Done<Model, Routes>
  : never;

type PhaseModel<P extends AnyPhase> = P extends Next<
  infer Model,
  readonly AnyRoute[],
  infer _Requirement
> ? Model
  : P extends Done<infer Model, readonly AnyRoute[]> ? Model
  : never;

type ApplyModel<
  Model extends object,
  F extends ModelTransform,
> = Model extends F["input"] ? ApplyTransform<F, Model>
  : never;

type MaterializeModel<Model extends object> = SimplifyModel<Model>;

type SimplifyModel<Model> = { [K in keyof Model]: Model[K] };

type Last<P extends AnyPhases> = P extends readonly [
  ...AnyPhase[],
  infer Tail extends AnyPhase,
] ? Tail
  : never;

type ContinueLast<
  P extends AnyPhases,
  Requirement,
> = P extends readonly [infer Only extends AnyPhase]
  ? readonly [WithRequirement<Only, Requirement>]
  : P extends readonly [
    infer Head extends AnyPhase,
    ...infer Middle extends readonly AnyPhase[],
    infer Tail extends AnyPhase,
  ] ? readonly [
      Head,
      ...Middle,
      WithRequirement<Tail, Requirement>,
    ]
  : never;

type ConcatPhases<
  A extends AnyPhases,
  B extends AnyPhases,
> = A extends readonly [
  infer AHead extends AnyPhase,
  ...infer ATail extends AnyPhase[],
] ? B extends readonly [
    infer BHead extends AnyPhase,
    ...infer BTail extends AnyPhase[],
  ] ? readonly [AHead, ...ATail, BHead, ...BTail]
  : never
  : never;

type WithRequirement<
  P extends AnyPhase,
  Requirement,
> = P extends Phase<infer Model, infer Children, never>
  ? Phase<Model, Children, Requirement>
  : never;

type MaterializePhase<P extends AnyPhase> = P extends Next<
  infer Model,
  infer Routes,
  infer Requirement
> ? Next<
    { [K in keyof Model]: Model[K] },
    Routes,
    Requirement
  >
  : P extends Done<infer Model, infer Routes> ? Done<
      { [K in keyof Model]: Model[K] },
      Routes
    >
  : never;

type RouteKeys = keyof Route<
  string,
  Method,
  AnyPhases
>;

type WithExtras<R extends AnyRoute, S> = keyof Omit<S, RouteKeys> extends never
  ? R
  : R & Omit<S, RouteKeys>;
