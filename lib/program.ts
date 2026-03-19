import type { Input, ParseResult, Parser, ParserInfo } from "./types.ts";
import { object } from "./object.ts";
import { lazy } from "./lazy.ts";
import { format } from "./help.ts";
import { step } from "./step.ts";

export interface Program<T> {
  help?: boolean;
  version?: boolean;
  main: Parser<T>;
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

  config.progname = [name];

  let named: Parser<T> = {
    ...config,
    inspect(input: Input = {}) {
      let info = config.inspect(input);
      return {
        ...info,
        help: {
          ...info.help,
          progname: [name, ...info.help.progname],
        },
      };
    },
  };

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
        main: lazy(next),
      }),
    to: () => named,
  });

  inner.progname = [name];

  let parser = {
    ...inner,
    parse(input: Input) {
      return parser.inspect(input).result;
    },
    inspect(input: Input = {}): ProgramInfo<T> {
      let preamble = inner.inspect(input);
      let remainder = preamble.result.ok ? preamble.result.remainder : input;
      let main = named.inspect(remainder);
      return {
        type: "program",
        parser,
        result: preamble.result as ParseResult<Program<T>>,
        name,
        version,
        preamble,
        main,
        help: {
          progname: [name],
          args: [...preamble.help.args, ...main.help.args],
          opts: [...preamble.help.opts, ...main.help.opts],
          commands: [...preamble.help.commands, ...main.help.commands],
        },
      };
    },
    help(input: Input = {}): string {
      return format(parser.inspect(input));
    },
  } as Parser<Program<T>, ProgramInfo<T>>;

  return parser;
}
