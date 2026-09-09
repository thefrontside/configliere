// deno-lint-ignore-file ban-types
import type { Check, Fold, Materialize, Unary } from "./pipeline.ts";
import type { Definition, Done, Route } from "./types.ts";

export type CommandZero<N extends string = string> = Route<
  N,
  "help" | "execute",
  {},
  [],
  [Done<{}, []>]
>;

export function command<
  const N extends string,
  const E extends readonly Unary[],
>(
  start: Definition<N>,
  ...elements: E & Check<CommandZero<N>, E>
): Materialize<Fold<CommandZero<N>, E>> {
  let zero: CommandZero<N> = {
    ...start,
    methods: ["help", "execute"],
    phases: [{
      params: {},
      routes: [],
      values: [],
      envs: [],
    }],
  };

  return elements.reduce<unknown>(
    (value, element) => element(value as never),
    zero,
  ) as Materialize<Fold<CommandZero<N>, E>>;
}
