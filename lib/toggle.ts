import { type Param, param, schema } from "./param.ts";
import type { CLIRead, ReadCLI } from "./read.ts";
import type { Flag } from "./tokenize.ts";
import type { AnyRoute, Definition, Schema } from "./types.ts";
import type { Element } from "./elements.ts";

export function toggle<const N extends string, T>(
  named: Definition<N>,
  ...transforms: readonly ((value: Param<N, unknown>) => Param<N, T>)[]
): Element<never, { [K in N]: T }, readonly []> {
  const transform = ((route: AnyRoute) => {
    const added = transforms.reduce<Param<N, unknown>>(
      (value, element) => element(value),
      param(named, binding(named.name), schema(bool)),
    );

    return {
      ...route,
      params: {
        ...route.params,
        [added.name]: added,
      },
    };
  }) as unknown as Element<never, { [K in N]: T }, readonly []>;

  return transform;
}

function binding(
  name: string,
): <P extends Param<string, unknown>>(param: P) => P {
  const cli = reader(name);
  return (param) => ({ ...param, cli });
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
