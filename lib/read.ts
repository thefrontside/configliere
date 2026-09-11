import type { Maybe } from "./maybe.ts";
import type { Param } from "./param.ts";
import { brand, type IdentityElement } from "./pipeline.ts";
import type { Result } from "./result.ts";
import type { Flag, Setter, Word } from "./tokenize.ts";
import type { Claim, TokenInput } from "./tokenizer.ts";

export type Symbol = Flag | Setter | Word;

export type ReadCLI = (
  tokens: TokenInput<Symbol>,
  multiple?: boolean,
) => CLIRead;

export interface CLIBinding {
  readonly read: ReadCLI;
  readonly syntax?: CLISyntax;
}

export type CLISyntax =
  | { readonly type: "argument"; readonly label: string }
  | { readonly type: "option"; readonly label: string };

export interface CLIRead {
  result: Result<Maybe<string | boolean | unknown[]>>;
  claim: Claim<Symbol>;
}

export interface CLIOptions {
  switch?: true;
}

export function cli(
  names: readonly string[],
  options: CLIOptions = {},
): IdentityElement<Param<string, unknown>> {
  const readOne: ReadCLI = (tokens) => {
    if (options.switch) {
      let s = tokens.claimOne((t): t is Flag => {
        return t.type === "flag" && names.includes(t.text);
      });
      let [flag] = s.tokens;
      return flag
        ? {
          result: {
            ok: true,
            value: { exists: true, value: true },
            issues: [],
          },
          claim: s,
        }
        : nothing(tokens);
    }
    let setter = tokens.claimOne((token): token is Setter => {
      return (token.type === "setter" && names.includes(`--${token.nameText}`));
    });
    let [token] = setter.tokens;
    if (token) {
      return {
        claim: setter,
        result: {
          ok: true,
          value: {
            exists: true,
            value: token.valueText,
          },
          issues: [],
        },
      };
    }
    let pair = tokens.claimPair((name, value) => {
      return name.type === "flag" && names.includes(name.text) &&
        value.type === "word";
    });
    let [, value] = pair.tokens;
    if (value) {
      return {
        claim: pair,
        result: {
          ok: true,
          value: {
            exists: true,
            value: value.text,
          },
          issues: [],
        },
      };
    }
    let bare = tokens.claimOne((t): t is Flag => {
      return t.type === "flag" && names.includes(t.text);
    });
    let [incomplete] = bare.tokens;
    if (incomplete) {
      return {
        claim: bare,
        result: {
          ok: false,
          issues: [{
            message: `${incomplete.text} requires a value`,
          }],
        },
      };
    }
    return nothing(tokens);
  };

  const readMany: ReadCLI = (tokens) => {
    let claimed = new Set<number>();
    let values: unknown[] = [];
    let issues = [];
    let visible = Array.from(tokens);

    for (let index = 0; index < visible.length; index++) {
      let token = visible[index];

      if (
        !options.switch && token.type === "setter" &&
        names.includes(`--${token.nameText}`)
      ) {
        claimed.add(token.index);
        values.push(token.valueText);
        continue;
      }

      if (token.type !== "flag" || !names.includes(token.text)) {
        continue;
      }

      let value = visible[index + 1];
      if (value?.type === "word" && value.index === token.index + 1) {
        claimed.add(token.index);
        claimed.add(value.index);
        values.push(value.text);
        index++;
      } else if (options.switch) {
        claimed.add(token.index);
        values.push(true);
      } else {
        claimed.add(token.index);
        issues.push({ message: `${token.text} requires a value` });
      }
    }

    if (claimed.size === 0) {
      return nothing(tokens);
    }

    return {
      claim: tokens.claimAll((token) => claimed.has(token.index)),
      result: issues.length > 0
        ? { ok: false, issues }
        : { ok: true, value: { exists: true, value: values }, issues: [] },
    };
  };

  const read: ReadCLI = (tokens, multiple = false) => {
    return multiple ? readMany(tokens) : readOne(tokens);
  };

  return brand<IdentityElement<Param<string, unknown>>>(
    (param: Param<string, unknown>) => ({
      ...param,
      cli: {
        read,
        syntax: {
          type: "option",
          label: options.switch
            ? names.join(", ")
            : `${names.join(", ")} <VALUE>`,
        },
      },
    }),
  );
}

function nothing(tokenizer: TokenInput<Symbol>): CLIRead {
  let claim = tokenizer.claimAll(() => false);

  return {
    claim,
    result: {
      ok: true,
      value: { exists: false },
      issues: [],
    },
  };
}
