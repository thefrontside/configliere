import type { AnyRoute, WithRequirement } from "./types.ts";

export function dynamic<
  Before extends AnyRoute,
  Requirement,
  After extends AnyRoute,
>(
  extension: (requires: Requirement) => (input: Before) => After,
): (input: Before) => WithRequirement<After, Requirement> {
  //@ts-expect-error;
  return (id) => id;
}
