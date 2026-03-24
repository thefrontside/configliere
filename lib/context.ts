import type { Input, ParseContext } from "./types.ts";

export function createContext(input: Input = {}): ParseContext {
  return {
    progname: [],
    path: [],
    commands: {},
    args: input.args ?? [],
    values: input.values ?? [],
    envs: input.envs ?? [],
  };
}
