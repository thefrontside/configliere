import type { Maybe } from "./maybe.ts";
import type { Param } from "./param.ts";
import type { Symbol } from "./read.ts";
import type { Rest } from "./rest.ts";
import type { Result } from "./result.ts";
import type { Word } from "./tokenize.ts";
import type { TokenInput, Tokenizer, TokenRange } from "./tokenizer.ts";
import type { AnyPhase, Issue, Path } from "./types.ts";

export interface Binding<T> {
  readonly rest: Rest;
  readonly result: Result<T>;
}

export interface PhaseBinding {
  readonly rest: Rest;
  readonly model: Record<string, unknown>;
  readonly issues: Issue[];
  readonly valid: boolean;
}

export interface PhaseSegment {
  readonly range: TokenRange;
  readonly path: Path;
}

export function fromCLI<const K extends string, T>(options: {
  readonly param: Param<K, T>;
  readonly view: TokenInput<Symbol>;
  readonly rest: Rest;
}): Maybe<Binding<T>> {
  let { param, view, rest } = options;
  let path = [param.name];
  let read = param.cli(view);

  if (!read.result.ok) {
    return {
      exists: true,
      value: {
        rest: {
          ...rest,
          tokens: read.claim.rest,
        },
        result: read.result,
      },
    };
  }

  if (!read.result.value.exists) {
    return { exists: false };
  }

  let value = read.result.value.value;
  let candidates = typeof value === "string" ? param.decode(value) : [value];
  let result = merge(
    decode(param, value, candidates, path),
    read.result.issues,
  );

  return {
    exists: true,
    value: {
      rest: {
        ...rest,
        tokens: read.claim.rest,
      },
      result,
    },
  };
}

export function fromValues<const K extends string, T>(options: {
  readonly param: Param<K, T>;
  readonly route: Path;
  readonly rest: Rest;
}): Maybe<Binding<T>> {
  let { param, route, rest } = options;
  let claim = rest.values.claim({
    route,
    address: [param.name],
  });

  if (!claim.result.exists) {
    return { exists: false };
  }

  return {
    exists: true,
    value: {
      rest: {
        ...rest,
        values: claim.rest,
      },
      result: validate(param, claim.result.value.value, [param.name]),
    },
  };
}

export function fromEnv<const K extends string, T>(options: {
  readonly param: Param<K, T>;
  readonly route: Path;
  readonly rest: Rest;
}): Maybe<Binding<T>> {
  let { param, route, rest } = options;
  let claim = rest.envs.claim({
    route,
    address: [param.name],
    key: param.env,
  });

  if (!claim.result.exists) {
    return { exists: false };
  }

  let value = claim.result.value.value;

  return {
    exists: true,
    value: {
      rest: {
        ...rest,
        envs: claim.rest,
      },
      result: decode(param, value, param.decode(value), [param.name]),
    },
  };
}

export function bindPhase(options: {
  readonly phase: AnyPhase;
  readonly segment: PhaseSegment;
  readonly rest: Rest;
}): PhaseBinding {
  let { phase, segment } = options;
  let rest = options.rest;
  let params = Object.values(phase.params) as Param<string, unknown>[];
  let pending = new Map(params.map((param) => [param.name, param]));
  let results = new Map<string, Result<unknown>>();

  function accept(
    param: Param<string, unknown>,
    attempt: Maybe<Binding<unknown>>,
  ): void {
    if (!attempt.exists) {
      return;
    }

    rest = attempt.value.rest;
    results.set(param.name, attempt.value.result);
    pending.delete(param.name);
  }

  // CLI visibility grows whenever a parameter consumes the current horizon.
  // Keep retrying provisional misses until a complete sweep leaves the first
  // remaining word unchanged.
  while (true) {
    let before = first(rest.tokens, segment.range);

    for (let param of pending.values()) {
      let attempt = fromCLI({
        param,
        view: rest.tokens.view({
          range: segment.range,
          through: before?.index,
        }),
        rest,
      });

      accept(param, attempt);
    }

    let after = first(rest.tokens, segment.range);
    if (after?.index === before?.index) {
      break;
    }
  }

  // Address sources have stable visibility once the route is known. They are
  // tried only after CLI has reached its fixed point so a provisional CLI miss
  // cannot let a lower-priority source settle the parameter too early.
  for (let source of [fromEnv, fromValues]) {
    for (let param of pending.values()) {
      accept(
        param,
        source({
          param,
          route: segment.path,
          rest,
        }),
      );
    }
  }

  // Only total absence reaches the schema as undefined. This is where required,
  // optional, and defaulting parameters diverge.
  for (let param of pending.values()) {
    results.set(param.name, validate(param, undefined, [param.name]));
  }

  let model: Record<string, unknown> = {};
  let issues: Issue[] = [];
  let valid = true;

  // Collect in declaration order, independent of the source or sweep that
  // settled each parameter.
  for (let param of params) {
    let result = results.get(param.name)!;
    issues.push(...result.issues ?? []);

    if (result.ok) {
      model[param.name] = result.value;
    } else {
      valid = false;
    }
  }

  return { rest, model, issues, valid };
}

function decode<T>(
  param: Param<string, T>,
  value: unknown,
  candidates: unknown[],
  path: string[],
): Result<T> {
  if (candidates.length === 0) {
    return {
      ok: false,
      issues: [{
        message: `unable to decode ${JSON.stringify(value)}`,
        path,
      }],
    };
  }

  let issues: readonly Issue[] | undefined;

  for (let candidate of candidates) {
    let result = validate(param, candidate, path);
    if (result.ok) {
      return result;
    }
    issues = issues ?? result.issues;
  }

  return {
    ok: false,
    issues: issues ?? [],
  };
}

function validate<T>(
  param: Param<string, T>,
  value: unknown,
  path: string[],
): Result<T> {
  let validated = param.schema["~standard"].validate(value);
  if (validated instanceof Promise) {
    return {
      ok: false,
      issues: [{
        message: `async schemas are not allowed`,
        path,
      }],
    };
  }

  if (validated.issues) {
    return {
      ok: false,
      issues: validated.issues.map((issue) => ({
        ...issue,
        message: issue.message,
        path,
      })),
    };
  }

  return {
    ok: true,
    issues: [],
    value: validated.value,
  };
}

function merge<T>(
  result: Result<T>,
  issues: readonly Issue[] | undefined,
): Result<T> {
  if (!issues || issues.length === 0) {
    return result;
  }

  return {
    ...result,
    issues: [...issues, ...(result.issues ?? [])],
  };
}

function first(tokens: Tokenizer<Symbol>, range: TokenRange): Word | undefined {
  for (let token of tokens.view({ range })) {
    if (token.type === "word") {
      return token;
    }
  }
}
