import { boolean as decode } from "./decode.ts";
import { type Param, param, schema } from "./param.ts";
import {
  brand,
  type Check,
  type Fold,
  type ParamElement,
  type Unary,
} from "./pipeline.ts";
import type { CLIRead, ReadCLI } from "./read.ts";
import type { Flag } from "./tokenize.ts";
import type { AnyRoute, Definition, Schema } from "./types.ts";

export function toggle<
  const N extends string,
  const E extends readonly Unary[],
>(
  named: Definition<N>,
  ...elements: E & Check<Param<N, boolean>, E>
): ElementOf<N, Fold<Param<N, boolean>, E>> {
  const added = elements.reduce<unknown>(
    (value, element) => element(value as never),
    {
      ...param(named, binding(named.name), schema(bool)),
      decode,
    },
  ) as Param<string, unknown>;

  return brand<ElementOf<N, Fold<Param<N, boolean>, E>>>(
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

function binding(
  name: string,
): <P extends Param<string, unknown>>(param: P) => P {
  const stem = dash(name);
  const yes = `--${stem}`;
  const no = `--no-${stem}`;

  return (param) => ({
    ...param,
    cli: {
      read: reader(name),
      syntax: {
        type: "option",
        label: `${yes}, ${no}`,
      },
    },
  });
}

function reader(name: string): ReadCLI {
  const stem = dash(name);
  const yes = `--${stem}`;
  const no = `--no-${stem}`;

  return (tokens): CLIRead => {
    let claim = tokens.claimOne((token): token is Flag => {
      return token.type === "flag" &&
        (token.text === yes || token.text === no);
    });
    let [flag] = claim.tokens;

    return flag
      ? {
        claim,
        result: {
          ok: true,
          value: { exists: true, value: flag.text === yes },
          issues: [],
        },
      }
      : {
        claim,
        result: {
          ok: true,
          value: { exists: false },
          issues: [],
        },
      };
  };
}

function dash(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

const bool: Schema<boolean> = {
  "~standard": {
    version: 1,
    vendor: "configliere",
    validate(value) {
      return typeof value === "undefined"
        ? { value: false }
        : typeof value === "boolean"
        ? { value }
        : { issues: [{ message: "expected boolean" }] };
    },
  },
};
