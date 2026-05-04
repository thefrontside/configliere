import type { AvailableInput, Input, ParseContext, Prefix } from "./types.ts";

export function createContext(input: Input = {}): ParseContext {
  let normalized: Input = {
    args: input.args ?? [],
    values: input.values ?? [],
    envs: input.envs ?? [],
  };
  return {
    progname: [],
    prefix: emptyPrefix(),
    input: normalized,
    available: toAvailable(normalized),
  };
}

export function emptyPrefix(): Prefix {
  return { values: [], envs: "", args: [] };
}

export function toAvailable(input: Input): AvailableInput {
  return {
    args: (input.args ?? []).map((value, index) => ({ index, value })),
    values: (input.values ?? []).map((entry) => ({
      source: entry.name,
      value: entry.value,
    })),
    envs: (input.envs ?? []).map((entry) => ({
      source: entry.name,
      value: entry.value,
    })),
  };
}
