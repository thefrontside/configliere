import type { Input, Parser, ParserInfo } from "./types.ts";
import { object } from "./object.ts";
import { lazy } from "./lazy.ts";
import { format } from "./help.ts";
import { step } from "./step.ts";

export interface Program<T> {
  help?: boolean;
  version?: boolean;
  parser: Parser<T>;
}

export interface ProgramInfo extends ParserInfo {
  type: "program";
  name: string;
  version?: string;
  info: ParserInfo;
}

export function program<T>(
  opts: {
    name: string;
    version?: string;
    config: Parser<T>;
  },
): Parser<Program<T>> {
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

  return {
    ...inner,
    inspect(input: Input = {}): ProgramInfo {
      return { type: "program", name, version, info: inner.inspect(input) };
    },
    help(input: Input = {}): string {
      return format(inner.inspect(input), name);
    },
  } as Parser<Program<T>>;
}
