import type { AnyRoute } from "./types.ts";
import { type AnyElement, brand, type DynamicElement } from "./pipeline.ts";

export type { ConjoinPhases, Seed } from "./pipeline.ts";
export type PhaseOf<R extends AnyRoute> = R["phases"][0];
export type PhasesOf<R extends AnyRoute> = R["phases"];

export function dynamic<
  Requirement,
  E,
>(
  extension: (requires: Requirement) => E,
  ..._valid: E extends AnyElement ? [] : [never]
): DynamicElement<Requirement, Extract<E, AnyElement>> {
  return brand<DynamicElement<Requirement, Extract<E, AnyElement>>>(
    (route: AnyRoute) => {
      let phases = [...route.phases];
      let phase = phases.pop()!;

      phases.push({
        ...phase,
        resolver: extension as unknown as (
          requirement: never,
        ) => (input: never) => AnyRoute,
      });
      phases.push({
        params: {},
        routes: [],
        values: [],
        envs: [],
      });

      return { ...route, phases };
    },
  );
}
