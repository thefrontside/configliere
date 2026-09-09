import { brand, type IdentityElement } from "./pipeline.ts";
import type { Definition } from "./types.ts";

export function name<N extends string>(name: N): Definition<N> {
  return { name };
}

export function description(
  description: string,
): IdentityElement<Definition<string>> {
  return brand<IdentityElement<Definition<string>>>((
    definition: Definition<string>,
  ) => ({
    ...definition,
    description,
  }));
}
