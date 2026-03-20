import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  Command,
  CommandInfo,
  CommandsInfo,
  HelpInfo,
  Input,
  ParseContext,
  Parser,
  ParserInfo,
} from "./types.ts";
import { constant } from "./constant.ts";
import { toSnake } from "ts-case-convert";
import { cli, field } from "./field.ts";
import { object } from "./object.ts";
import { format } from "./help.ts";
import { createContext } from "./context.ts";

export type CommandEntry = Partial<Parser<unknown>>;

export type CommandParsers<T extends Command<unknown, string>> = {
  [C in T as C["name"]]: Partial<Parser<C["config"]>>;
};

export interface Help {
  info: ParserInfo<Command<unknown, string>>;
  text: string;
}

export const help: Parser<Help> = {
  description: "show help for a command",
  parse(input: Input) {
    return help.inspect(createContext(input)).result;
  },
  inspect(ctx: ParseContext): ParserInfo<Help> {
    let cmds = ctx.commands ?? {};
    let names = Object.keys(cmds);

    let schema: StandardSchemaV1<string> = {
      "~standard": {
        version: 1,
        vendor: "configliere",
        validate(value) {
          if (typeof value === "string" && names.includes(value)) {
            return { value };
          }
          return {
            issues: [{
              message: `unknown command: ${value}. available: ${
                names.join(", ")
              }`,
            }],
          };
        },
      },
    };

    let inner = object({
      command: {
        description: "command to show help for",
        ...field(schema, cli.argument()),
      },
    });

    let parsed = inner.parse({ args: ctx.args });
    let self = inner.inspect(ctx).help;

    if (!parsed.ok) {
      let remainder = { args: ctx.args, values: ctx.values, envs: ctx.envs };
      return {
        type: "help",
        parser: help,
        result: { ok: false, error: parsed.error, remainder },
        remainder,
        help: self,
      };
    }

    let cmd = cmds[parsed.value.command];
    let info = cmd.inspect({
      ...ctx,
      args: parsed.remainder.args ?? [],
    });
    let text = format(info);

    let remainder = { args: ctx.args, values: ctx.values, envs: ctx.envs };
    return {
      type: "help",
      parser: help,
      result: {
        ok: true,
        value: { info, text },
        remainder,
      },
      remainder,
      help: self,
    };
  },
  help(input: Input = {}): string {
    return format(help.inspect(createContext(input)));
  },
};

export interface CommandParser<C extends Command<unknown, string>>
  extends Parser<C, CommandInfo<C>> {
}

export interface CommandsParser<T extends Command<unknown, string>>
  extends Parser<T, CommandsInfo<T>> {
  default?: string;
}

export function commands<T extends Command<unknown, string>>(
  map: CommandParsers<T>,
  opts?: { default?: string },
): CommandsParser<T> {
  let cmds: Record<string, CommandParser<Command<unknown, string>>> = {};

  let parser = {
    default: opts?.default,
    parse(input: Input) {
      return parser.inspect(createContext(input)).result;
    },
    inspect(ctx: ParseContext): CommandsInfo<T> {
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
        } as unknown as CommandsInfo<T>;
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
      } as unknown as CommandsInfo<T>;
    },
    help(input: Input = {}): string {
      return format(parser.inspect(createContext(input)));
    },
  } as CommandsParser<T>;

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

  return parser;
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
    parse(input: Input) {
      return parser.inspect(createContext(input)).result;
    },
    inspect(ctx: ParseContext): CommandInfo<Command<T, Name>> {
      let cmdCtx = {
        ...ctx,
        progname: [...ctx.progname, name],
        commands: ctx.commands,
      };
      let config = inner.inspect(cmdCtx);
      let remainder = { args: ctx.args, values: ctx.values, envs: ctx.envs };
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
          opts: config.help.opts,
          commands: config.help.commands,
        },
        remainder,
      };
    },
    help(input: Input = {}): string {
      return format(parser.inspect(createContext(input)));
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
