import type {
  AddParamToPhase,
  AddRoutesToPhase,
  AnyPhase,
  AnyPhases,
  AnyRoute,
  ChildrenOf,
  Done,
  Method,
  MethodsOf,
  ModelOf,
  ModelSchema,
  Next,
  Phase,
  Route,
  SetField,
} from "./types.ts";

export type Element<O extends Unary> = {
  readonly [operation]: O;
};

export type AnyElement = Element<Unary>;

export type Unary = (value: never) => unknown;

export type AnyPipelineElement = Unary;

export interface Transform {
  readonly input: unknown;
  readonly output: unknown;
}

export type ApplyTransform<F extends Transform, S> = (
  F & { readonly input: S }
)["output"];

export interface TransformElement<F extends Transform> {
  readonly [operation]: <S extends F["input"]>(
    value: S,
  ) => ApplyTransform<F, S>;
  readonly transform: F;

  <S extends F["input"]>(value: S): ApplyTransform<F, S>;
}

export interface IdentityElement<S> {
  readonly [operation]: <T extends S>(value: T) => T;
  readonly input: S;

  <T extends S>(value: T): T;
}

export interface MethodElement<Added extends Method> {
  readonly [operation]: MethodOperation<Added>;
  readonly method: Added;

  <
    const N extends string,
    const M extends Method,
    const T extends object,
    const C extends readonly AnyRoute[],
    const P extends AnyPhases,
  >(route: Route<N, M, T, C, P>): Route<N, M | Added, T, C, P>;
}

export interface ParamElement<K extends string, V> {
  readonly [operation]: ParamOperation<K, V>;
  readonly key: K;
  readonly value: V;

  <
    const N extends string,
    const M extends Method,
    const T extends object,
    const C extends readonly AnyRoute[],
    const P extends AnyPhases,
  >(route: Route<N, M, T, C, P>): Route<
    N,
    M,
    SetField<T, K, V>,
    C,
    AddParamToPhase<P, K, V>
  >;
}

export interface RoutesElement<Added extends readonly AnyRoute[]> {
  readonly [operation]: RoutesOperation<Added>;
  readonly children: Added;

  <
    const N extends string,
    const M extends Method,
    const T extends object,
    const C extends readonly AnyRoute[],
    const P extends AnyPhases,
  >(route: Route<N, M, T, C, P>): Route<
    N,
    M,
    T,
    readonly [...C, ...Added],
    AddRoutesToPhase<P, Added>
  >;
}

export interface ModelTransformElement<
  F,
  E extends readonly Unary[],
> {
  readonly [operation]: ModelTransformOperation<F, E>;

  <
    const N extends string,
    const M extends Method,
    const T extends object,
    const C extends readonly AnyRoute[],
    const P extends AnyPhases,
  >(route: Route<N, M, T, C, P>): Fold<
    Route<N, M, T, C, P>,
    E
  > extends infer After extends AnyRoute ? Route<
      After["name"],
      MethodsOf<After>,
      Merge<ModelOf<After>, ModelTransformOutput<F>>,
      ChildrenOf<After>,
      SetFieldsToPhase<After["phases"], ModelTransformOutput<F>>
    >
    : never;
}

type ModelTransformOutput<F> = F extends ModelSchema<infer Output>
  ? Output extends Record<string, unknown> ? Output : {}
  : F extends (...args: never[]) => infer Output
    ? Output extends Record<string, unknown> ? Output : {}
  : never;

export type Extension<E extends readonly Unary[]> =
  & Element<BatchOperation<E>>
  & { readonly elements: E }
  & (E extends readonly AnyElement[] ? GenericExtension<E>
    : ConcreteExtension<E>);

interface GenericExtension<E extends readonly Unary[]> {
  readonly [operation]: BatchOperation<E>;

  <S extends InputOfPipeline<E>>(value: S): Fold<S, E>;
}

interface ConcreteExtension<E extends readonly Unary[]> {
  (
    value: [Fold<InputOfPipeline<E>, E>] extends [never] ? never
      : InputOfPipeline<E>,
  ): Fold<InputOfPipeline<E>, E>;
}

export interface DynamicElement<Requirement, E extends AnyElement> {
  readonly [operation]: DynamicOperation<E>;
  readonly requirement: Requirement;
  readonly element: E;

  <R extends AnyRoute>(
    route: R,
  ): DynamicAfter<R, E> extends infer After extends AnyRoute ? Route<
      After["name"],
      MethodsOf<After>,
      ModelOf<After>,
      ChildrenOf<After>,
      ConjoinPhases<R, After, Requirement>
    >
    : never;
}

export type Seed<R extends AnyRoute> = Route<
  R["name"],
  MethodsOf<R>,
  ModelOf<R>,
  ChildrenOf<R>,
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
> = number extends E["length"] ? Widened<S>
  : E extends readonly [
    infer Head extends AnyPipelineElement,
    ...infer Tail extends readonly AnyPipelineElement[],
  ] ? true extends IsUnion<Head> ? Widened<S>
    : Head extends AnyElement
      ? S extends AnyRoute
        ? IsStatic<Head> extends true ? TakeStatic<E> extends readonly [
            infer Fields extends object,
            infer Routes extends readonly AnyRoute[],
            infer Methods extends Method,
            infer Rest extends readonly AnyPipelineElement[],
          ] ? Fold<WithStatic<S, Fields, Routes, Methods>, Rest>
          : never
        : Fold<ApplyElement<S, Head>, Tail>
      : Fold<ApplyElement<S, Head>, Tail>
    : Head extends (value: S) => infer Output ? Fold<Output, Tail>
    : never
  : S;

export type Materialize<S> = AnyRoute extends S ? S
  : S extends Route<
    infer N,
    infer M,
    infer Model,
    infer Children,
    infer Phases
  > ? WithExtras<
      Route<
        N,
        M,
        { [K in keyof Model]: Model[K] },
        Children,
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

type MethodOperation<M extends Method> = <R extends AnyRoute>(
  route: R,
) => Route<R["name"], MethodsOf<R> | M, ModelOf<R>, ChildrenOf<R>, R["phases"]>;

type ParamOperation<K extends string, V> = <R extends AnyRoute>(
  route: R,
) => WithParams<R, { [P in K]: V }>;

type RoutesOperation<C extends readonly AnyRoute[]> = <R extends AnyRoute>(
  route: R,
) => Route<
  R["name"],
  MethodsOf<R>,
  ModelOf<R>,
  readonly [...ChildrenOf<R>, ...C],
  AddRoutesToPhase<R["phases"], C>
>;

type ModelTransformOperation<F, E extends readonly Unary[]> = <
  R extends AnyRoute,
>(
  route: R,
) => Fold<R, E> extends infer After extends AnyRoute ? Route<
    After["name"],
    MethodsOf<After>,
    Merge<ModelOf<After>, ModelTransformOutput<F>>,
    ChildrenOf<After>,
    SetFieldsToPhase<After["phases"], ModelTransformOutput<F>>
  >
  : never;

type BatchOperation<E extends readonly Unary[]> = <
  S extends InputOfPipeline<E>,
>(
  value: S,
) => Fold<S, E>;

type DynamicOperation<E extends AnyElement> = <R extends AnyRoute>(
  route: R,
) => DynamicAfter<R, E>;

type ApplyElement<S, E extends AnyElement> = E extends
  IdentityElement<infer Input> ? S extends Input ? S : never
  : E extends MethodElement<infer M> ? S extends AnyRoute ? Route<
        S["name"],
        MethodsOf<S> | M,
        ModelOf<S>,
        ChildrenOf<S>,
        S["phases"]
      >
    : never
  : E extends ParamElement<infer K, infer V>
    ? S extends AnyRoute ? WithParams<S, { [P in K]: V }>
    : never
  : E extends RoutesElement<infer C> ? S extends AnyRoute ? Route<
        S["name"],
        MethodsOf<S>,
        ModelOf<S>,
        readonly [...ChildrenOf<S>, ...C],
        AddRoutesToPhase<S["phases"], C>
      >
    : never
  : E extends ModelTransformElement<infer F, infer X>
    ? S extends AnyRoute
      ? Fold<S, X> extends infer After extends AnyRoute ? Route<
          After["name"],
          MethodsOf<After>,
          Merge<ModelOf<After>, ModelTransformOutput<F>>,
          ChildrenOf<After>,
          SetFieldsToPhase<After["phases"], ModelTransformOutput<F>>
        >
      : never
    : never
  : E extends Extension<infer X> ? Fold<S, X>
  : E extends DynamicElement<infer Requirement, infer X>
    ? S extends AnyRoute
      ? DynamicAfter<S, X> extends infer After extends AnyRoute ? Route<
          After["name"],
          MethodsOf<After>,
          ModelOf<After>,
          ChildrenOf<After>,
          ConjoinPhases<S, After, Requirement>
        >
      : never
    : never
  : E extends TransformElement<infer F>
    ? S extends F["input"] ? ApplyTransform<F, S>
    : never
  : Widened<S>;

type IsStatic<E extends AnyElement> = E extends
  | IdentityElement<unknown>
  | MethodElement<Method>
  | ParamElement<string, unknown>
  | RoutesElement<readonly AnyRoute[]> ? true
  : false;

type IsUnion<T, Whole = T> = T extends unknown ? [Whole] extends [T] ? false
  : true
  : never;

// Widened pipelines must not claim a state more specific than their input.
type Widened<S> = S extends AnyRoute ? AnyRoute : unknown;

type OpenDynamic<S extends AnyRoute> = Route<
  S["name"],
  MethodsOf<S>,
  ModelOf<S>,
  readonly [...ChildrenOf<S>, ...AnyRoute[]],
  readonly [Done<Record<string, unknown>, readonly AnyRoute[]>]
>;

type DynamicAfter<S extends AnyRoute, E extends AnyElement> =
  ApplyElement<Seed<S>, E> extends infer After extends AnyRoute
    ? AnyRoute extends After ? OpenDynamic<Seed<S>> : After
    : never;

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

type InputOf<E extends AnyPipelineElement> = E extends
  IdentityElement<infer Input> ? Input
  : E extends TransformElement<infer F> ? F["input"]
  : E extends { readonly elements: infer X }
    ? X extends
      readonly [infer Head extends AnyPipelineElement, ...AnyPipelineElement[]]
      ? InputOf<Head>
    : unknown
  : E extends AnyElement ? AnyRoute
  : E extends (value: infer Input) => unknown ? Input
  : never;

type InputOfPipeline<E extends readonly AnyPipelineElement[]> = E extends
  readonly [
    infer Head extends AnyPipelineElement,
    ...readonly AnyPipelineElement[],
  ] ? InputOf<Head>
  : unknown;

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
  ] ? Head extends IdentityElement<unknown> ? TakeStatic<
        Tail,
        Fields,
        Routes,
        Methods,
        readonly [...Count, unknown]
      >
    : Head extends MethodElement<infer M> ? TakeStatic<
        Tail,
        Fields,
        Routes,
        Methods | M,
        readonly [...Count, unknown]
      >
    : Head extends ParamElement<infer K, infer V> ? TakeStatic<
        Tail,
        readonly [...Fields, { [P in K]: V }],
        Routes,
        Methods,
        readonly [...Count, unknown]
      >
    : Head extends RoutesElement<infer C> ? TakeStatic<
        Tail,
        Fields,
        readonly [...Routes, ...C],
        Methods,
        readonly [...Count, unknown]
      >
    : readonly [MergeFields<Fields>, Routes, Methods, E]
  : readonly [MergeFields<Fields>, Routes, Methods, E];

// Collect fields before applying them so each static chunk builds the model once.
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

type WithStatic<
  R extends AnyRoute,
  Fields extends object,
  Routes extends readonly AnyRoute[],
  Methods extends Method,
> = Route<
  R["name"],
  MethodsOf<R> | Methods,
  keyof Fields extends never ? ModelOf<R> : Merge<ModelOf<R>, Fields>,
  Routes extends readonly [] ? ChildrenOf<R>
    : readonly [...ChildrenOf<R>, ...Routes],
  AddStaticToPhase<R["phases"], Fields, Routes>
>;

type AddStaticToPhase<
  P extends AnyPhases,
  Fields extends object,
  Routes extends readonly AnyRoute[],
> = keyof Fields extends never ? Routes extends readonly [] ? P
  : AddRoutesToPhase<P, Routes>
  : Routes extends readonly [] ? SetFieldsToPhase<P, Fields>
  : AddRoutesToPhase<SetFieldsToPhase<P, Fields>, Routes>;

type WithParams<R extends AnyRoute, Fields extends object> = Route<
  R["name"],
  MethodsOf<R>,
  Merge<ModelOf<R>, Fields>,
  ChildrenOf<R>,
  SetFieldsToPhase<R["phases"], Fields>
>;

type SetFieldsToPhase<
  P extends AnyPhases,
  Fields extends object,
> = P extends readonly [infer Only extends AnyPhase]
  ? readonly [SetFields<Only, Fields>]
  : P extends readonly [
    infer First extends AnyPhase,
    ...infer Middle extends AnyPhase[],
    AnyPhase,
  ] ? readonly [First, ...Middle, SetFields<Last<P>, Fields>]
  : never;

type SetFields<P extends AnyPhase, Fields extends object> = P extends Next<
  infer Model,
  infer Routes,
  infer Requirement
> ? Next<Merge<Model, Fields>, Routes, Requirement>
  : P extends Done<infer Model, infer Routes> ? Done<
      Merge<Model, Fields>,
      Routes
    >
  : never;

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

type Merge<A extends object, B extends object> = Simplify<
  Omit<A, keyof B> & B
>;

type Simplify<T> = { [K in keyof T]: T[K] };

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
  object,
  readonly AnyRoute[],
  AnyPhases
>;

type WithExtras<R extends AnyRoute, S> = keyof Omit<S, RouteKeys> extends never
  ? R
  : R & Omit<S, RouteKeys>;
