import type { Param } from "./param.ts";
import type { Symbol } from "./read.ts";
import type { Result } from "./result.ts";
import type { Flag, Setter, Word } from "./tokenize.ts";
import type { Tokenizer } from "./tokenizer.ts";
import type { Issue } from "./types.ts";

export interface Binding<T> {
  rest: Tokenizer<Symbol>;
  result: Result<T>;
}

export function bind<T, P extends Param<string, T>>(options: {
  param: P;
  tokens: Tokenizer<Flag | Setter | Word>;
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
      issues: validated.issues.map((i) => ({ ...i, path })),
    };
  } else {
    return {
      ok: true,
      issues: [],
      value: validated.value,
    };
  }
}
