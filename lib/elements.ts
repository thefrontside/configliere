// deno-lint-ignore-file ban-types
import type { AnyRoute, Definition, Method, Route } from "./types.ts";

// Merge<A, B>: the params object after adding B's keys on top of A's. The
// mapped type keeps the result Equal to a plain object literal, which the
// tests require. A bare A & B intersection fails those checks.
type Merge<A extends object, B extends object> = {
  [K in keyof (A & B)]: (A & B)[K];
};

// Element<M, P, C>: takes any Route, returns a Route with M, P, C merged in.
// The callable carries a declaration-only `contribution` property so the
// fold can read M/P/C exactly. Inference from the callable alone falls back
// to the Method and AnyRoute[] constraints, because M hides inside the
// SM | M union and C trails a variadic. The fold would then read Method and
// AnyRoute[] where it needs never and readonly [].
export type Element<
  M extends Method = never,
  P extends object = {},
  C extends readonly AnyRoute[] = [],
> =
  & (<
    N extends string,
    SM extends Method,
    SP extends object,
    SC extends readonly AnyRoute[],
  >(
    route: Route<N, SM, SP, SC>,
  ) => Route<N, SM | M, Merge<P, SP>, readonly [...SC, ...C]>)
  & {
    readonly contribution: readonly [M, P, C];
  };

export type AnyElement = Element<Method, object, readonly AnyRoute[]>;

// DefinitionTransform: description()'s shape. It hands back the Definition
// it receives, which lets one function serve as both a no-op pipeline member
// and an option/toggle transform.
export type DefinitionTransform = {
  <D extends Definition<string>>(definition: D): D;
};

// AnyRouteElement: what a pipeline accepts. Elements carry their
// contribution. description() is admitted through DefinitionTransform rather
// than being re-typed as an Element.
export type AnyRouteElement = AnyElement | DefinitionTransform;

// Transformer<M, P, C>: the shape a transformer must have to claim the
// contribution M, P, C. It takes any Route and returns that Route with the
// contribution merged in. withRoute applies this formal to transformers the
// compiler can check (version, executable, routes, bare no-op wrappers).
// Transformers the compiler cannot check -- option and toggle build a params
// key from runtime data, which no spread can prove -- cast straight to
// Element instead. Generic method unions stay comparable, so method-identity
// mistakes pass the formal even where it applies.
export type Transformer<
  M extends Method = never,
  P extends object = {},
  C extends readonly AnyRoute[] = readonly [],
> = <
  N extends string,
  SM extends Method,
  SP extends object,
  SC extends readonly AnyRoute[],
>(
  route: Route<N, SM, SP, SC>,
) => Route<
  N,
  SM | M,
  Merge<P, SP>,
  // A transformer either passes the children through or appends its own.
  // The union keeps identity returns assignable for any C, inferred or not.
  SC | readonly [...SC, ...C]
>;

// withRoute<M, P, C>: types a transformer as the Element it declares. The
// function comes back unchanged. Only its type changes: it gains the
// contribution marker the fold reads. Give hand-written transformers like
// version and routes their shape here, or wrap a bare function to admit it
// as a no-op element. The parameter type stays plain so bare lambdas get a
// contextual type; the return must be a Route. Contributions always come
// from the explicit M/P/C arguments.
export function withRoute<
  const M extends Method = never,
  const P extends object = {},
  const C extends readonly AnyRoute[] = readonly [],
>(
  f: Transformer<M, P, C>,
): Element<M, P, C> {
  return f as unknown as Element<M, P, C>;
}

// Build<Name, Methods, Elements>: the Route produced by reducing Elements
// over a RouteZero that starts with Method methods
export type Build<
  Name extends string,
  M extends Method,
  Ds extends readonly unknown[],
> = Finish<Fold<State<Name, M, {}, []>, PartsOf<Ds>>>;

type State<N, M, P, C> = readonly [N, M, P, C];

// PartsOf<Ds>: each element's contribution [M, P, C], read from its
// declaration-only property. Definition-transformers and plain functions
// contribute nothing.
type PartsOf<Ds extends readonly unknown[]> = {
  [K in keyof Ds]: Ds[K] extends DefinitionTransform ? readonly []
    : Ds[K] extends {
      readonly contribution: readonly [infer M, infer P, infer C];
    } ? readonly [M, P, C]
    : readonly [];
};

// Fold<S, Ds>: threads the accumulated [name, methods, params, children]
// through each element's contribution, mirroring the runtime reduce.
type Fold<
  S extends State<string, Method, object, readonly AnyRoute[]>,
  Ds extends readonly unknown[],
> = Ds extends readonly [infer Head, ...infer Rest] ? Head extends readonly [
    infer M extends Method,
    infer P extends object,
    infer C extends readonly AnyRoute[],
  ] ? Fold<
      State<
        S[0],
        S[1] | M,
        Merge<P, S[2]>,
        C extends readonly [] ? S[3] : readonly [...S[3], ...C]
      >,
      Rest
    >
  : Fold<S, Rest>
  : S;

type Finish<S extends State<string, Method, object, readonly AnyRoute[]>> =
  Route<S[0], S[1], S[2], S[3]>;
