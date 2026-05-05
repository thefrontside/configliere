import type { AvailableInput, Token } from "./types.ts";

export function emptyAvailable(): AvailableInput {
  return { args: [], values: [], envs: [] };
}

export function subtract(
  available: AvailableInput,
  claims: Token[],
): AvailableInput {
  let argIndices = new Set<number>();
  let valuesByPath = new Map<string, string[][]>();
  let envsByName = new Map<string, Set<string>>();
  for (let t of claims) {
    if (t.type === "arg") {
      for (let i = t.from; i <= t.to; i++) argIndices.add(i);
    } else if (t.type === "value") {
      let bucket = valuesByPath.get(t.source) ?? [];
      bucket.push(t.path);
      valuesByPath.set(t.source, bucket);
    } else {
      let set = envsByName.get(t.source) ?? new Set<string>();
      set.add(t.name);
      envsByName.set(t.source, set);
    }
  }

  let nextArgs = argIndices.size === 0
    ? available.args
    : available.args.filter((a) => !argIndices.has(a.index));

  let nextValues = available.values.map((entry) => {
    let paths = valuesByPath.get(entry.source);
    if (!paths || paths.length === 0) return entry;
    return { source: entry.source, value: prune(entry.value, paths) };
  });

  let nextEnvs = available.envs.map((entry) => {
    let names = envsByName.get(entry.source);
    if (!names || names.size === 0) return entry;
    let copy: Record<string, string> = {};
    for (let [k, v] of Object.entries(entry.value)) {
      if (!names.has(k)) copy[k] = v;
    }
    return { source: entry.source, value: copy };
  });

  return { args: nextArgs, values: nextValues, envs: nextEnvs };
}

// Backwards-compat alias for callers that only need args subtraction.
export function subtractArgs(
  available: AvailableInput,
  claims: Token[],
): AvailableInput {
  let argIndices = new Set<number>();
  for (let t of claims) {
    if (t.type === "arg") {
      for (let i = t.from; i <= t.to; i++) argIndices.add(i);
    }
  }
  if (argIndices.size === 0) return available;
  return {
    ...available,
    args: available.args.filter((a) => !argIndices.has(a.index)),
  };
}

export function isEmpty(av: AvailableInput): boolean {
  return av.args.length === 0 && av.values.length === 0 && av.envs.length === 0;
}

// --- internal ---

function prune(value: unknown, paths: string[][]): unknown {
  if (value == null || typeof value !== "object") return value;
  let result: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (let path of paths) {
    if (path.length === 0) continue;
    pruneAt(result, path);
  }
  return result;
}

function pruneAt(obj: Record<string, unknown>, path: string[]): void {
  if (path.length === 1) {
    delete obj[path[0]];
    return;
  }
  let head = path[0];
  let rest = path.slice(1);
  let inner = obj[head];
  if (inner == null || typeof inner !== "object") return;
  let copy = { ...(inner as Record<string, unknown>) };
  pruneAt(copy, rest);
  obj[head] = copy;
}
