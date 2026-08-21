import type { Maybe } from "./maybe.ts";
import type { Param } from "./param.ts";
import type { Symbol } from "./read.ts";
import type { Result } from "./result.ts";
import type { Flag, Setter, Word } from "./tokenize.ts";
import type { Tokenizer } from "./tokenizer.ts";

export interface Binding<T> {
  rest: Tokenizer<Symbol>;
  result: Result<Maybe<T>>;
}

export function bind<T, P extends Param<string, T>>(options: {
  param: P;
  tokens: Tokenizer<Flag | Setter | Word>;
}): Binding<T> {
  let { param, tokens } = options;
  let path = [param.name];
  let cli = param.cli(tokens);

  if (cli.result.ok && cli.result.value.exists) {
    let { value } = cli.result.value;
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
    for (let candidate of candidates) {
      let validated = param.schema["~standard"].validate(candidate);
      if (validated instanceof Promise) {
        return {
          rest: cli.claim.rest,
          result: {
            ok: false,
            issues: [{
              message: `async schemas are not allowed`,
              path,
            }],
          },
        };
      }
      if (!validated.issues) {
        return {
          rest: cli.claim.rest,
          result: {
            ok: true,
            value: {
              exists: true,
              value: validated.value,
            },
            issues: [],
          },
        } as Binding<T>;
      } else {
        return {
          rest: cli.claim.rest,
          result: {
            ok: false,
            issues: validated.issues,
          },
        };
      }
    }
  }
  return {
    rest: tokens,
    result: {
      ok: true,
      value: { exists: false },
      issues: [],
    },
  };
}
