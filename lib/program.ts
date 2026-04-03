import type {
  ConfigType,
  FieldInfo,
  Input,
  ParseContext,
  Parser,
  ParserInfo,
} from "./types.ts";
import { format } from "./help.ts";
import { createContext } from "./context.ts";

export interface Program<T> {
  help?: boolean;
  version?: string;
  config: T;
}

export type ProgramType<P extends Parser<Program<unknown>>> =
  ConfigType<P> extends Program<infer T> ? T : never;

export interface ProgramInfo<T> extends ParserInfo<Program<T>> {
  type: "program";
  name: string;
  version?: string;
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

  let parser = {
    parse(input: Input, ctx?: ParseContext) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): ProgramInfo<T> {
      let args = ctx.args;
      let help = false;
      let ver: string | undefined;

      if (args[0] === "--help" || args[0] === "-h") {
        help = true;
        args = args.slice(1);
      } else if (version && (args[0] === "--version" || args[0] === "-v")) {
        ver = version;
        args = args.slice(1);
      }

      let rootCtx = { ...ctx, progname: [name], args };
      let remainder = { args: ctx.args, values: ctx.values, envs: ctx.envs };
      let main = config.inspect(rootCtx);

      // Post-parse: if help/version was not detected at args[0],
      // check if it survived into the config parser's remainder.
      // When a sub-parser (command) handles --help, it removes the token
      // from its result remainder, so it won't appear here.
      let resultRemainder = main.result.remainder;
      if (!help && !ver) {
        let remainderArgs = resultRemainder?.args ?? [];
        let dashDashIndex = remainderArgs.indexOf("--");
        let searchEnd = dashDashIndex === -1
          ? remainderArgs.length
          : dashDashIndex;

        for (let i = 0; i < searchEnd; i++) {
          if (remainderArgs[i] === "--help" || remainderArgs[i] === "-h") {
            help = true;
            resultRemainder = {
              ...resultRemainder,
              args: [
                ...remainderArgs.slice(0, i),
                ...remainderArgs.slice(i + 1),
              ],
            };
            break;
          }
        }

        if (!help && version) {
          let versionArgs = resultRemainder?.args ?? [];
          let versionDashDash = versionArgs.indexOf("--");
          let versionSearchEnd = versionDashDash === -1
            ? versionArgs.length
            : versionDashDash;
          for (let i = 0; i < versionSearchEnd; i++) {
            if (versionArgs[i] === "--version" || versionArgs[i] === "-v") {
              ver = version;
              resultRemainder = {
                ...resultRemainder,
                args: [
                  ...versionArgs.slice(0, i),
                  ...versionArgs.slice(i + 1),
                ],
              };
              break;
            }
          }
        }
      }

      let value: Program<T> = {
        ...(help ? { help: true } : {}),
        ...(ver ? { version: ver } : {}),
        config: main.result.ok ? main.result.value : undefined as T,
      };

      let result = (main.result.ok || help || ver)
        ? {
          ok: true as const,
          value,
          remainder: resultRemainder,
        }
        : main.result;

      return {
        type: "program",
        parser,
        result,
        remainder,
        name,
        version,
        main,
        help: {
          progname: [name],
          args: main.help.args,
          opts: [
            ...main.help.opts,
            ...preamble(version),
          ],
          commands: main.help.commands,
        },
      };
    },
    help(input: Input = {}, ctx?: ParseContext): string {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  } as Parser<Program<T>, ProgramInfo<T>>;

  return parser;
}

// --- internal ---

export const helpOpt = {
  path: ["help"],
  aliases: ["-h"],
  boolean: true,
  description: "show help",
} as FieldInfo<unknown>;

function preamble(version?: string): FieldInfo<unknown>[] {
  if (version) {
    return [
      helpOpt,
      {
        path: ["version"],
        aliases: ["-v"],
        boolean: true,
        description: "show version",
      } as FieldInfo<unknown>,
    ];
  }
  return [helpOpt];
}
