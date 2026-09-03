import type { Param } from "./param.ts";
import type { Symbol } from "./read.ts";
import type { Rest } from "./rest.ts";
import type { Result } from "./result.ts";
import type { Flag, Setter, Word } from "./tokenize.ts";
import type { TokenInput, Tokenizer, TokenRange } from "./tokenizer.ts";
import type { AnyPhase, Issue } from "./types.ts";

export interface Binding<T> {
  rest: Rest;
  result: Result<T>;
}

export interface PhaseBinding {
  rest: Rest;
  model: Record<string, unknown>;
  issues: Issue[];
  valid: boolean;
  cursor?: number;
}

export interface PhaseSegment {
  readonly range: TokenRange;
  readonly cursor?: number;
}

export function bind<T, P extends Param<string, T>>(options: {
  param: P;
  view: TokenInput<Flag | Setter | Word>;
  rest: Rest;
}): Binding<T> {
  let { param, view, rest } = options;
  let path = [param.name];
  let cli = param.cli(view);
  let next = {
    ...rest,
    tokens: cli.claim.rest,
  };

  if (cli.result.ok) {
    let read = cli.result.value;
    let value: unknown = read.exists ? read.value : undefined;

    let candidates = typeof value === "string" ? param.decode(value) : [value];

    if (candidates.length === 0) {
      return {
        rest: next,
        result: {
          ok: false,
          issues: [{
            message: `unable to decode ${JSON.stringify(value)}`,
            path,
          }],
        },
      };
    }

    let issues: readonly Issue[] | undefined = undefined;
    for (let candidate of candidates) {
      let result = validate<T, P>(param, candidate, path);
      if (result.ok) {
        return {
          rest: next,
          result,
        };
      } else {
        issues = issues ?? result.issues;
      }
    }

    return {
      rest: next,
      result: {
        ok: false,
        issues: issues ?? [],
      },
    };
  }

  return {
    rest: next,
    result: {
      ok: false,
      issues: cli.result.issues,
    },
  };
}

export function bindPhase(options: {
  phase: AnyPhase;
  segment: PhaseSegment;
  rest: Rest;
}): PhaseBinding {
  let { phase, segment } = options;
  let rest = options.rest;
  let params = Object.values(phase.params) as Param<string, unknown>[];
  let cursor = segment.cursor;
  let results = new Map<string, Result<unknown>>();
  let settled = new Set<string>();

  while (true) {
    for (let param of params) {
      if (settled.has(param.name)) {
        continue;
      }

      let tokens = rest.tokens;
      let binding = bind({
        param,
        view: tokens.view({
          range: segment.range,
          through: cursor,
        }),
        rest,
      });

      results.set(param.name, binding.result);
      rest = binding.rest;

      if (rest.tokens !== tokens) {
        settled.add(param.name);
      }
    }

    if (cursor === undefined || has(rest.tokens, segment.range, cursor)) {
      break;
    }

    cursor = next(rest.tokens, segment.range, cursor);
  }

  let model: Record<string, unknown> = {};
  let issues: Issue[] = [];
  let valid = true;

  for (let param of params) {
    let result = results.get(param.name);
    if (!result) {
      continue;
    }

    issues.push(...result.issues ?? []);

    if (result.ok) {
      model[param.name] = result.value;
    } else {
      valid = false;
    }
  }

  return { rest, model, issues, valid, cursor };
}

function validate<T, P extends Param<string, T>>(
  param: P,
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
  } else {
    return {
      ok: true,
      issues: [],
      value: validated.value,
    };
  }
}

function has(
  tokens: Tokenizer<Symbol>,
  range: TokenRange,
  index: number,
): boolean {
  for (let token of tokens.view({ range })) {
    if (token.index === index) {
      return true;
    }
  }
  return false;
}

function next(
  tokens: Tokenizer<Symbol>,
  range: TokenRange,
  index: number,
): number | undefined {
  for (let token of tokens.view({ range })) {
    if (token.index > index && token.type === "word") {
      return token.index;
    }
  }
}
