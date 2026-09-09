import type { Definition } from "./types.ts";

export function name<N extends string>(name: N): Definition<N> {
  return { name };
}

export function description(
  description: string,
): <D extends Definition<string>>(definition: D) => D {
  return (definition) => ({
    ...definition,
    description,
  });
}
