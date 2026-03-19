import type { Input, ParseResult, Parser, ParserInfo } from "./types.ts";
import { object } from "./object.ts";
import { lazy } from "./lazy.ts";
import { format } from "./help.ts";
import { step } from "./step.ts";

export interface Program<T> {
  help?: boolean;
  version?: boolean;
  parser: Parser<T>;
}

export interface ProgramInfo<T> extends ParserInfo<Program<T>> {
  type: "program";
  name: string;
  version?: string;
  preamble: ParserInfo<unknown>;
  main: ParserInfo<T>;
}

export function program<T>(
  opts: {
    name: string;
    version?: string;
    config: Parser<T>;
  },
): Parser<Program<T>, ProgramInfo<T>> {
  let { name, version, config } = opts;

  let inner = step({
    from: (next) =>
      object({
        help: {
          description: "show help",
          aliases: ["-h"],
        },
        ...(version
          ? {
            version: {
              description: "show version",
              aliases: ["-v"],
            },
          }
          : {}),
        parser: lazy(next),
      }),
    to: () => config,
  });

  let parser = {
    ...inner,
    parse(input: Input) {
      return parser.inspect(input).result;
    },
    inspect(input: Input = {}): ProgramInfo<T> {
      let preamble = inner.inspect(input);
      let remainder = preamble.result.ok ? preamble.result.remainder : input;
      let main = config.inspect(remainder);
      return { type: "program", parser, result: preamble.result as ParseResult<Program<T>>, name, version, preamble, main };
    },
    help(input: Input = {}): string {
      return format(parser.inspect(input), name);
    },
  } as Parser<Program<T>, ProgramInfo<T>>;

  return parser;
}
