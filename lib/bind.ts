import type { Param } from "./param.ts";
import type { Symbol } from "./read.ts";
import type { Result } from "./result.ts";
import type { Flag, Setter, Word } from "./tokenize.ts";
import { type TokenInput, Tokenizer } from "./tokenizer.ts";
import type { AnyPhase, Issue } from "./types.ts";

export interface Binding<T> {
  rest: Tokenizer<Symbol>;
  result: Result<T>;
}

export interface PhaseBinding {
  rest: Tokenizer<Symbol>;
  model: Record<string, unknown>;
  issues: Issue[];
  valid: boolean;
  cursor?: number;
}

export interface PhaseSegment {
  readonly tokens: Iterable<Symbol>;
  readonly cursor?: number;
}

export function bind<T, P extends Param<string, T>>(options: {
  param: P;
  tokens: TokenInput<Flag | Setter | Word>;
}): Binding<T> {
  let { param, tokens } = options;
  let path = [param.name];
  let cli = param.cli(tokens);

  if (cli.result.ok) {
    let read = cli.result.value;
    let value: unknown = read.exists ? read.value : undefined;

    let candidates = typeof value === "string" ? param.decode(value) : [value];

    if (candidates.length === 0) {
      return {
        rest: cli.claim.rest,
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
          rest: cli.claim.rest,
          result,
        };
      } else {
        issues = issues ?? result.issues;
      }
    }

    return {
      rest: cli.claim.rest,
      result: {
        ok: false,
        issues: issues ?? [],
      },
    };
  }

  return {
    rest: cli.claim.rest,
    result: {
      ok: false,
      issues: cli.result.issues,
    },
  };
}

export function bindPhase(options: {
  phase: AnyPhase;
  segment: PhaseSegment;
  tokens: Tokenizer<Symbol>;
}): PhaseBinding {
  let { phase, segment } = options;
  let tokens = options.tokens;
  let params = Object.values(phase.params) as Param<string, unknown>[];
  let members = new Set(Array.from(segment.tokens, (token) => token.index));
  let cursor = segment.cursor;
  let results = new Map<string, Result<unknown>>();
  let settled = new Set<string>();

  while (true) {
    for (let param of params) {
      if (settled.has(param.name)) {
        continue;
      }

      let visible = Array.from(tokens).filter((token) => {
        return members.has(token.index) &&
          (cursor === undefined || token.index <= cursor);
      });
      let binding = bind({
        param,
        tokens: new Tokenizer(visible),
      });
      let remaining = new Set(
        Array.from(binding.rest, (token) => token.index),
      );
      let claimed = new Set(
        visible
          .filter((token) => !remaining.has(token.index))
          .map((token) => token.index),
      );

      results.set(param.name, binding.result);

      if (claimed.size > 0) {
        tokens = tokens.claimAll((token) => claimed.has(token.index)).rest;
        settled.add(param.name);
      }
    }

    if (cursor === undefined || has(tokens, members, cursor)) {
      break;
    }

    cursor = next(tokens, members, cursor);
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

  return { rest: tokens, model, issues, valid, cursor };
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
  members: Set<number>,
  index: number,
): boolean {
  for (let token of tokens) {
    if (members.has(token.index) && token.index === index) {
      return true;
    }
  }
  return false;
}

function next(
  tokens: Tokenizer<Symbol>,
  members: Set<number>,
  index: number,
): number | undefined {
  for (let token of tokens) {
    if (
      members.has(token.index) && token.index > index && token.type === "word"
    ) {
      return token.index;
    }
  }
}
