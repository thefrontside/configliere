import { type Param, param } from "./param.ts";
import {
  brand,
  type Check,
  type Fold,
  type ParamElement,
  type Unary,
} from "./pipeline.ts";
import type { CLIRead, ReadCLI } from "./read.ts";
import type { Word } from "./tokenize.ts";
import type { AnyRoute, Definition } from "./types.ts";

export function argument<
  const N extends string,
  const E extends readonly Unary[],
>(
  named: Definition<N>,
  ...elements: E & Check<Param<N, unknown>, E>
): ElementOf<N, Fold<Param<N, unknown>, E>> {
  const added = elements.reduce<unknown>(
    (value, element) => element(value as never),
    param(named, positional),
  ) as Param<string, unknown>;

  return brand<ElementOf<N, Fold<Param<N, unknown>, E>>>(
    (route: AnyRoute) => {
      let phases = [...route.phases];
      let phase = phases.pop()!;
      phases.push({
        ...phase,
        params: {
          ...phase.params,
          [added.name]: added,
        },
      });

      return {
        ...route,
        phases,
      };
    },
  );
}

type ValueOf<P> = P extends Param<string, infer T> ? T : never;

type ElementOf<N extends string, P> = P extends Param<N, unknown>
  ? ParamElement<N, ValueOf<P>>
  : never;

function positional<P extends Param<string, unknown>>(param: P): P {
  return { ...param, cli: read };
}

const read: ReadCLI = (tokens): CLIRead => {
  let claim = tokens.claimOne((token): token is Word => token.type === "word");
  let [word] = claim.tokens;

  return word
    ? {
      claim,
      result: {
        ok: true,
        value: { exists: true, value: word.text },
        issues: [],
      },
    }
    : nothing(tokens);
};

function nothing(tokens: Parameters<ReadCLI>[0]): CLIRead {
  let claim = tokens.claimAll(() => false);

  return {
    claim,
    result: {
      ok: true,
      value: { exists: false },
      issues: [],
    },
  };
}
