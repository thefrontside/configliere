import type { AnyStep, Input, Parser, Step, ToSteps } from "./types.ts";

export type Sequence<Values extends [unknown, ...unknown[]]> =
  & Parser<ToSteps<Values>>
  & {
    parsers: Parser[];
  };

export function sequence<V1, V2>(
  p1: Parser<[Step<V1, unknown>]>,
  p2: Parser<[Step<V2, unknown>]>,
): Sequence<[V1, V2]>;

export function sequence<V1, V2, V3>(
  p1: Parser<[Step<V1, unknown>]>,
  p2: Parser<[Step<V2, unknown>]>,
  p3: Parser<[Step<V3, unknown>]>,
): Sequence<[V1, V2, V3]>;

export function sequence<V1, V2, V3, V4>(
  p1: Parser<[Step<V1, unknown>]>,
  p2: Parser<[Step<V2, unknown>]>,
  p3: Parser<[Step<V3, unknown>]>,
  p4: Parser<[Step<V4, unknown>]>,
): Sequence<[V1, V2, V3, V4]>;

export function sequence(
  ...parsers: Parser<[AnyStep]>[]
): Parser<[AnyStep, ...AnyStep[]]> & { parsers: Parser[] } {
  return {
    parsers,
    path: [],
    parse(input) {
      return step(parsers, 0, input, []);
    },
  };
}

function step(
  parsers: Parser<[AnyStep]>[],
  index: number,
  input: Input,
  data: unknown[],
  // deno-lint-ignore no-explicit-any
): any {
  let result = parsers[index].parse(input);

  if (!result.ok) return result;

  let accumulated = [...data, result.data];

  if (index < parsers.length - 1) {
    return {
      ok: true,
      path: [],
      value: result.value,
      data: result.data,
      remainder: result.remainder,
      parse(next: Input) {
        return step(parsers, index + 1, next, accumulated);
      },
    };
  }

  return {
    ok: true,
    value: result.value,
    data: accumulated,
    remainder: result.remainder,
  };
}
