import { boolean as decode } from "./decode.ts";
import { type Param, param, schema } from "./param.ts";
import type { CLIRead, ReadCLI } from "./read.ts";
import type { Flag } from "./tokenize.ts";
import type {
  AddParamToLast,
  AnyPhases,
  AnyRoute,
  Definition,
  Method,
  Route,
  Schema,
} from "./types.ts";

export function toggle<const N extends string>(
  named: Definition<N>,
): Toggle<N, boolean>;

export function toggle<const N extends string, T>(
  named: Definition<N>,
  nt: (value: Param<N, boolean>) => Param<N, T>,
): Toggle<N, T>;

export function toggle<const N extends string, A, T>(
  named: Definition<N>,
  na: (value: Param<N, boolean>) => A,
  at: (value: A) => Param<N, T>,
): Toggle<N, T>;

export function toggle<const N extends string, A, B, T>(
  named: Definition<N>,
  na: (value: Param<N, boolean>) => A,
  ab: (value: A) => B,
  bt: (value: B) => Param<N, T>,
): Toggle<N, T>;

export function toggle<const N extends string, A, B, C, T>(
  named: Definition<N>,
  na: (value: Param<N, boolean>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  ct: (value: C) => Param<N, T>,
): Toggle<N, T>;

export function toggle<const N extends string, A, B, C, D, T>(
  named: Definition<N>,
  na: (value: Param<N, boolean>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  dt: (value: D) => Param<N, T>,
): Toggle<N, T>;

export function toggle<const N extends string, A, B, C, D, E, T>(
  named: Definition<N>,
  na: (value: Param<N, boolean>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  et: (value: E) => Param<N, T>,
): Toggle<N, T>;

export function toggle<const N extends string, A, B, C, D, E, F, T>(
  named: Definition<N>,
  na: (value: Param<N, boolean>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  ft: (value: F) => Param<N, T>,
): Toggle<N, T>;

export function toggle<
  const N extends string,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  T,
>(
  named: Definition<N>,
  na: (value: Param<N, boolean>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gt: (value: G) => Param<N, T>,
): Toggle<N, T>;

export function toggle<
  const N extends string,
  A,
  B,
  C,
  D,
  E,
  F,
  G,
  H,
  T,
>(
  named: Definition<N>,
  na: (value: Param<N, boolean>) => A,
  ab: (value: A) => B,
  bc: (value: B) => C,
  cd: (value: C) => D,
  de: (value: D) => E,
  ef: (value: E) => F,
  fg: (value: F) => G,
  gh: (value: G) => H,
  ht: (value: H) => Param<N, T>,
): Toggle<N, T>;

export function toggle(
  named: Definition<string>,
  ...elements: readonly ((value: never) => unknown)[]
): unknown {
  const added = elements.reduce<unknown>(
    (value, element) => element(value as never),
    {
      ...param(named, binding(named.name), schema(bool)),
      decode,
    },
  ) as Param<string, unknown>;

  return (route: AnyRoute) => {
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
  };
}

type Toggle<K extends string, V> = <
  const N extends string,
  const M extends Method,
  const T extends object,
  const C extends readonly AnyRoute[],
  const P extends AnyPhases,
>(
  route: Route<N, M, T, C, P>,
) => Route<
  N,
  M,
  {
    [P in keyof ({ [Q in K]: V } & T)]: (
      { [Q in K]: V } & T
    )[P];
  },
  C,
  AddParamToLast<P, K, V>
>;

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
