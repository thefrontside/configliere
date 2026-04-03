import type {
  Command,
  CommandInfo,
  CommandsInfo,
  HelpInfo,
  Input,
  ParseContext,
  Parser,
} from "./types.ts";
import { constant } from "./constant.ts";
import { toSnake } from "ts-case-convert";
import { format } from "./help.ts";
import { helpOpt } from "./program.ts";
import { createContext } from "./context.ts";

export type CommandEntry = Partial<Parser<unknown>>;

export type CommandEntries<T extends Record<string, unknown>> = {
  [K in keyof T & string]: Partial<Parser<T[K]>>;
};

export interface CommandParser<C extends Command<unknown, string>>
  extends Parser<C, CommandInfo<C>> {
}

export interface CommandsParser<T extends Command<unknown, string>>
  extends Parser<T, CommandsInfo<T>> {
  default?: string;
}

export function commands<T extends Record<string, unknown>>(
  map: CommandEntries<T>,
  opts?: { default?: string },
): CommandsParser<
  { [K in keyof T & string]: Command<T[K], K> }[keyof T & string]
> {
  let cmds: Record<string, CommandParser<Command<unknown, string>>> = {};

  let parser = {
    default: opts?.default,
    parse(input: Input, ctx?: ParseContext) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): CommandsInfo<Command<unknown, string>> {
      let withCmds = { ...ctx, commands: cmds };
      let args = ctx.args;
      let matched = match(args, cmds, opts);
      let infos: Record<string, CommandInfo<Command<unknown, string>>> = {};
      for (let [name, cmd] of Object.entries(cmds)) {
        let info = cmd.inspect(scope(name, withCmds));
        infos[name] = info;
      }

      let help = {
        progname: ctx.progname,
        args: [] as HelpInfo["args"],
        opts: [] as HelpInfo["opts"],
        commands: Object.values(infos).map((info) => ({
          name: info.name,
          description: info.description,
          aliases: info.aliases,
        })) as HelpInfo["commands"],
      };

      let remainder = { args: ctx.args, values: ctx.values, envs: ctx.envs };

      if (!matched) {
        return {
          type: "commands",
          parser,
          result: {
            ok: false,
            error: new NoCommandMatchError(Object.keys(cmds)),
            remainder,
          },
          remainder,
          commands: infos,
          help,
        } as unknown as CommandsInfo<Command<unknown, string>>;
      }

      let [name, cmd, rest] = matched;
      let inner = cmd.inspect(scope(name, { ...withCmds, args: rest }));

      return {
        type: "commands",
        parser,
        result: inner.result,
        remainder,
        commands: infos,
        help,
      } as unknown as CommandsInfo<Command<unknown, string>>;
    },
    help(input: Input = {}, ctx?: ParseContext): string {
      let c = ctx ?? createContext(input);
      let matched = match(c.args, cmds);
      if (matched) {
        let [name, cmd, rest] = matched;
        return cmd.help(
          { ...input, args: rest },
          scope(name, { ...c, commands: cmds, args: rest }),
        );
      }
      return format(parser.inspect(c));
    },
  } as CommandsParser<Command<unknown, string>>;

  for (
    let [name, entry] of Object.entries(map) as [string, CommandEntry][]
  ) {
    let p = typeof entry.parse === "function"
      ? entry as Parser<unknown>
      : Object.assign(constant(true), entry);
    cmds[name] = command(name, p) as CommandParser<
      Command<unknown, string>
    >;
  }

  return parser as unknown as CommandsParser<
    { [K in keyof T & string]: Command<T[K], K> }[keyof T & string]
  >;
}

export class NoCommandMatchError extends Error {
  constructor(public available: string[]) {
    super(`No command matched. Available: ${available.join(", ")}`);
    this.name = "NoCommandMatchError";
  }
}

// --- internal ---

function match(
  args: string[],
  cmds: Record<string, CommandParser<Command<unknown, string>>>,
  opts?: { default?: string },
): [string, CommandParser<Command<unknown, string>>, string[]] | undefined {
  if (args.length > 0) {
    if (args[0] in cmds) return [args[0], cmds[args[0]], args.slice(1)];
    for (let [name, cmd] of Object.entries(cmds)) {
      if (cmd.aliases?.includes(args[0])) return [name, cmd, args.slice(1)];
    }
  }
  if (opts?.default && cmds[opts.default]) {
    return [opts.default, cmds[opts.default], args];
  }
  return undefined;
}

function command<T, const Name extends string>(
  name: Name,
  inner: Parser<T>,
): CommandParser<Command<T, Name>> {
  let parser: CommandParser<Command<T, Name>> = {
    description: inner.description,
    aliases: inner.aliases,
    parse(input: Input, ctx?: ParseContext) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): CommandInfo<Command<T, Name>> {
      let cmdCtx = {
        ...ctx,
        progname: [...ctx.progname, name],
        commands: ctx.commands,
      };
      let remainder = { args: ctx.args, values: ctx.values, envs: ctx.envs };

      // Run inner parser first with all args. If --help/-h survives
      // in the inner parser's remainder (no descendant consumed it),
      // produce help for this command. This preserves nested command
      // routing: a descendant commands() parser dispatches first and
      // its command() handles --help at the correct level.
      let config = inner.inspect(cmdCtx);

      let innerRemainder = config.result.remainder?.args ?? [];
      let dashDashIndex = innerRemainder.indexOf("--");
      let searchEnd = dashDashIndex === -1
        ? innerRemainder.length
        : dashDashIndex;
      let helpPosition = -1;
      for (let i = 0; i < searchEnd; i++) {
        if (
          innerRemainder[i] === "--help" || innerRemainder[i] === "-h"
        ) {
          helpPosition = i;
          break;
        }
      }

      if (helpPosition !== -1) {
        let help = {
          ...config.help,
          progname: [...ctx.progname, name],
          opts: [...config.help.opts, helpOpt],
        };
        let text = format({ ...config, help });
        let helpArgs = [
          ...innerRemainder.slice(0, helpPosition),
          ...innerRemainder.slice(helpPosition + 1),
        ];
        let helpRemainder = { ...remainder, args: helpArgs };
        return {
          type: "command",
          parser,
          result: {
            ok: true as const,
            value: { name, help: true as const, text } as Command<T, Name>,
            remainder: helpRemainder,
          },
          name,
          description: inner.description,
          aliases: inner.aliases,
          config,
          commands: {},
          help,
          remainder: helpRemainder,
        };
      }

      let result = config.result.ok
        ? {
          ok: true as const,
          value: { name, config: config.result.value } as Command<T, Name>,
          remainder: { ...remainder, args: config.result.remainder.args },
        }
        : config.result;

      return {
        type: "command",
        parser,
        result,
        name,
        description: inner.description,
        aliases: inner.aliases,
        config,
        commands: {},
        help: {
          progname: [...ctx.progname, name],
          args: config.help.args,
          opts: [...config.help.opts, helpOpt],
          commands: config.help.commands,
        },
        remainder,
      };
    },
    help(input: Input = {}, ctx?: ParseContext): string {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  };
  return parser;
}

function scope(name: string, ctx: ParseContext): ParseContext {
  let prefix = toSnake(name).toUpperCase() + "_";
  let values = ctx.values.flatMap((v) => {
    if (v.value == null) return [];
    let obj = v.value as Record<string, unknown>;
    if (!(name in obj)) return [];
    return [{ name: v.name, value: obj[name] }];
  });
  let envs = ctx.envs.map((env) => {
    let scoped: Record<string, string> = {};
    for (let [key, val] of Object.entries(env.value)) {
      if (key.startsWith(prefix)) {
        scoped[key.slice(prefix.length)] = val;
      } else {
        scoped[key] = val;
      }
    }
    return { name: env.name, value: scoped };
  });
  return { ...ctx, values, envs };
}
