import type { Input, ParseContext, Parser, ParserInfo } from "./types.ts";
import { object } from "./object.ts";
import { constant } from "./constant.ts";
import { format } from "./help.ts";
import { createContext } from "./context.ts";

export interface Program<T> {
  help?: boolean;
  version?: boolean;
  main: () => Parser<T>;
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

  let preamble = object({
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
    main: constant(null),
  });

  let parser = {
    parse(input: Input) {
      return parser.inspect(createContext(input)).result;
    },
    inspect(ctx: ParseContext): ProgramInfo<T> {
      let rootCtx = { ...ctx, progname: [name] };
      let info = preamble.inspect(rootCtx);
      let remainder = info.result.ok
        ? info.result.remainder
        : { args: ctx.args, values: ctx.values, envs: ctx.envs };
      let mainCtx = {
        ...rootCtx,
        args: remainder.args ?? [],
        values: remainder.values ?? [],
        envs: remainder.envs ?? [],
      };
      let main = config.inspect(mainCtx);

      // build a resolve function that bakes mainCtx into config
      let resolve = (): Parser<T> => ({
        ...config,
        parse(input) {
          return config.inspect({
            ...mainCtx,
            args: input?.args ?? mainCtx.args,
            values: input?.values ?? mainCtx.values,
            envs: input?.envs ?? mainCtx.envs,
          }).result;
        },
        help(input) {
          return format(config.inspect({
            ...mainCtx,
            args: input?.args ?? mainCtx.args,
            values: input?.values ?? mainCtx.values,
            envs: input?.envs ?? mainCtx.envs,
          }));
        },
      });

      let result = info.result.ok
        ? {
          ok: true as const,
          value: { ...info.result.value, main: resolve } as unknown as Program<
            T
          >,
          remainder: info.result.remainder,
        }
        : {
          ok: false as const,
          error: info.result.error,
          remainder: info.result.remainder,
        };

      return {
        type: "program",
        parser,
        result,
        remainder: { args: ctx.args, values: ctx.values, envs: ctx.envs },
        name,
        version,
        preamble: info,
        main,
        help: {
          progname: [name],
          args: [...info.help.args, ...main.help.args],
          opts: [...info.help.opts, ...main.help.opts],
          commands: [...info.help.commands, ...main.help.commands],
        },
      };
    },
    help(input: Input = {}): string {
      return format(parser.inspect(createContext(input)));
    },
  } as Parser<Program<T>, ProgramInfo<T>>;

  return parser;
}
