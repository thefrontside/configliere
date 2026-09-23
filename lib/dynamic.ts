import type {
  AnyPhase,
  AnyPhases,
  AnyRoute,
  ChildrenOf,
  MethodsOf,
  ModelOf,
  Phase,
  Route,
} from "./types.ts";

export function dynamic<
  Before extends AnyRoute,
  Requirement,
  After extends AnyRoute,
>(
  extension: (requires: Requirement) => (input: Seed<Before>) => After,
): (input: Before) => Conjoin<Before, After, Requirement> {
  return (route) => {
    let phases = [...route.phases];
    let phase = phases.pop()!;

    phases.push({
      ...phase,
      resolver: extension,
    });
    phases.push({
      params: {},
      routes: [],
      values: [],
    });

    return { ...route, phases } as unknown as Conjoin<
      Before,
      After,
      Requirement
    >;
  };
}

export type PhaseOf<R extends AnyRoute> = R["phases"][0];
export type PhasesOf<R extends AnyRoute> = R["phases"];

export type Seed<R extends AnyRoute> = Route<
  R["name"],
  MethodsOf<R>,
  ModelOf<R>,
  ChildrenOf<R>,
  readonly [Phase<{}, [], never>]
>;

type Conjoin<
  A extends AnyRoute,
  B extends AnyRoute,
  Requirement,
> = Route<
  B["name"],
  MethodsOf<B>,
  ModelOf<B>,
  ChildrenOf<B>,
  ConjoinPhases<A, B, Requirement>
>;

export type ConjoinPhases<
  A extends AnyRoute,
  B extends AnyRoute,
  Requirement,
> = ConcatPhases<
  ContinueLast<PhasesOf<A>, Requirement>,
  PhasesOf<B>
>;

type ContinueLast<
  P extends AnyPhases,
  Requirement,
> = P extends readonly [infer Only extends AnyPhase]
  ? readonly [WithRequirement<Only, Requirement>]
  : P extends readonly [
    infer Head extends AnyPhase,
    ...infer Middle extends readonly AnyPhase[],
    infer Last extends AnyPhase,
  ] ? readonly [
      Head,
      ...Middle,
      WithRequirement<Last, Requirement>,
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
  ] ? readonly [
      AHead,
      ...ATail,
      BHead,
      ...BTail,
    ]
  : never
  : never;

type WithRequirement<
  P extends AnyPhase,
  Requirement,
> = P extends Phase<infer Model, infer Children, never>
  ? Phase<Model, Children, Requirement>
  : never;
