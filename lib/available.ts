import type { AvailableInput, Token } from "./types.ts";

export function emptyAvailable(): AvailableInput {
  return { args: [], values: [], envs: [] };
}

export function subtractArgs(
  available: AvailableInput,
  claims: Token[],
): AvailableInput {
  let indices = new Set<number>();
  for (let token of claims) {
    if (token.type === "arg") {
      for (let i = token.from; i <= token.to; i++) indices.add(i);
    }
  }
  if (indices.size === 0) return available;
  return {
    ...available,
    args: available.args.filter((a) => !indices.has(a.index)),
  };
}

export function isEmpty(av: AvailableInput): boolean {
  return av.args.length === 0 && av.values.length === 0 && av.envs.length === 0;
}
