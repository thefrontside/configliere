import type {
  AvailableInput,
  Input,
  ParseContext,
  Prefix,
  Token,
} from "./types.ts";

export function createContext(input: Input = {}): ParseContext {
  let normalized: Input = {
    args: input.args ?? [],
    values: input.values ?? [],
    envs: input.envs ?? [],
  };

  function read(token: Extract<Token, { type: "arg" }>): string[];
  function read(token: Extract<Token, { type: "value" }>): unknown;
  function read(token: Extract<Token, { type: "env" }>): string;
  function read(token: Token): unknown {
    if (token.type === "arg") {
      return (normalized.args ?? []).slice(token.from, token.to + 1);
    }
    if (token.type === "value") {
      let entry = (normalized.values ?? []).find((e) => e.name === token.source);
      let cur: unknown = entry?.value;
      for (let k of token.path) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[k];
      }
      return cur;
    }
    let entry = (normalized.envs ?? []).find((e) => e.name === token.source);
    return entry?.value[token.name] ?? "";
  }

  return {
    progname: [],
    prefix: emptyPrefix(),
    input: normalized,
    available: toAvailable(normalized),
    read,
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
