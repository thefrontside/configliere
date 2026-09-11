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
    let [match] = matches(tokens);
    return match ? result(tokens, match) : nothing(tokens);
  };

  const readMany: ReadCLI = (tokens) => {
    let found = matches(tokens);
    if (found.length === 0) {
      return nothing(tokens);
    }

    let claimed = new Set(found.flatMap((match) => match.indices));
    let issues = found.flatMap((match) =>
      "issue" in match ? [match.issue] : []
    );
    return {
      claim: tokens.claimAll((token) => claimed.has(token.index)),
      result: issues.length > 0 ? { ok: false, issues } : {
        ok: true,
        value: {
          exists: true,
          value: found.map((match) =>
            "value" in match ? match.value : undefined
          ),
        },
        issues: [],
      },
    };
  };

  function matches(tokens: TokenInput<Symbol>): OptionMatch[] {
    let visible = Array.from(tokens);
    let found: OptionMatch[] = [];

    for (let index = 0; index < visible.length; index++) {
      let token = visible[index];

      if (
        !options.switch && token.type === "setter" &&
        names.includes(`--${token.nameText}`)
      ) {
        found.push({ indices: [token.index], value: token.valueText });
        continue;
      }

      if (token.type !== "flag" || !names.includes(token.text)) {
        continue;
      }

      if (options.switch) {
        found.push({ indices: [token.index], value: true });
        continue;
      }

      let value = visible[index + 1];
      if (value?.type === "word" && value.index === token.index + 1) {
        found.push({
          indices: [token.index, value.index],
          value: value.text,
        });
        index++;
      } else {
        found.push({
          indices: [token.index],
          issue: { message: `${token.text} requires a value` },
        });
      }
    }

    return found;
  }

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

type OptionMatch = {
  indices: number[];
  value: string | boolean;
} | {
  indices: number[];
  issue: { message: string };
};

function result(
  tokens: TokenInput<Symbol>,
  match: OptionMatch,
): CLIRead {
  let claim = tokens.claimAll((token) => match.indices.includes(token.index));
  if ("issue" in match) {
    return { claim, result: { ok: false, issues: [match.issue] } };
  }

  return {
    claim,
    result: {
      ok: true,
      value: { exists: true, value: match.value },
      issues: [],
    },
  };
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
