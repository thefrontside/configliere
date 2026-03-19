import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  Command,
  CommandInfo,
  CommandsInfo,
  HelpInfo,
  Input,
  Parser,
  ParserInfo,
} from "./types.ts";
import { constant } from "./constant.ts";
import { toSnake } from "ts-case-convert";
import { cli, field } from "./field.ts";
import { object } from "./object.ts";
import { format } from "./help.ts";

export type CommandEntry = Partial<Parser<unknown>>;

export type CommandParsers<T extends Command<unknown, string>> = {
  [C in T as C["name"]]: Partial<Parser<C["config"]>>;
};

export interface Help {
  info: ParserInfo<Command<unknown, string>>;
  text: string;
}

// help uses `this` intentionally — when spread into a CommandParser,
// `this.commands` gives access to the sibling commands map
export const help: Parser<Help> = {
    path: [] as string[],
    description: "show help for a command",
    parse(input: Input) {
      return this.inspect(input).result;
    },
    inspect(input: Input = {}): ParserInfo<Help> {
      let cmds = (this as unknown as CommandParser<Command<unknown, string>>).commands ?? {};
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

      let parsed = inner.parse(input);
      let self = inner.inspect(input).help;

      if (!parsed.ok) {
        return {
          type: "help",
          parser: this as unknown as Parser<Help>,
          result: { ok: false, error: parsed.error, remainder: parsed.remainder },
          help: self,
        };
      }

      let cmd = cmds[parsed.value.command];
      let info = cmd.inspect(parsed.remainder);
      let text = format(info);

      return {
        type: "help",
        parser: this as unknown as Parser<Help>,
        result: {
          ok: true,
          value: { info, text },
          remainder: parsed.remainder,
        },
        help: self,
      };
    },
    help(input: Input = {}): string {
      return format(this.inspect(input));
    },
  };

export interface CommandParser<C extends Command<unknown, string>>
  extends Parser<C, CommandInfo<C>> {
  commands: Record<string, CommandParser<Command<unknown, string>>>;
}

export interface CommandsParser<T extends Command<unknown, string>>
  extends Parser<T, CommandsInfo<T>> {
  progname: string[];
  commands: Record<string, CommandParser<Command<unknown, string>>>;
  default?: string;
}


export function commands<T extends Command<unknown, string>>(
  map: CommandParsers<T>,
  opts?: { default?: string },
): CommandsParser<T> {
  let cmds: Record<string, CommandParser<Command<unknown, string>>> = {};

  let parser = {
    progname: [] as string[],
    commands: cmds,
    default: opts?.default,
    path: [],
    parse(input: Input) {
      return parser.inspect(input).result;
    },
    inspect(input: Input = {}): CommandsInfo<T> {
      let args = input.args ?? [];
      let matched = match(args, cmds, opts);
      let infos: Record<string, CommandInfo<Command<unknown, string>>> = {};
      for (let [name, cmd] of Object.entries(cmds)) {
        let info = cmd.inspect(scope(name, input));
        infos[name] = info;
      }

      let help = {
        progname: parser.progname,
        args: [] as HelpInfo["args"],
        opts: [] as HelpInfo["opts"],
        commands: Object.values(infos).map((info) => ({
          name: info.name,
          description: info.description,
          aliases: info.aliases,
        })) as HelpInfo["commands"],
      };

      if (!matched) {
        return {
          type: "commands",
          parser,
          result: {
            ok: false,
            error: new NoCommandMatchError(Object.keys(cmds)),
            remainder: input,
          },
          commands: infos,
          help,
        } as unknown as CommandsInfo<T>;
      }

      let [name, cmd, remainder] = matched;
      let inner = cmd.inspect(scope(name, { ...input, args: remainder }));

      return {
        type: "commands",
        parser,
        result: inner.result,
        commands: infos,
        help,
      } as unknown as CommandsInfo<T>;
    },
    help(input: Input = {}): string {
      return format(parser.inspect(input));
    },
  } as CommandsParser<T>;

  for (
    let [name, entry] of Object.entries(map) as [string, CommandEntry][]
  ) {
    let p = typeof entry.parse === "function"
      ? entry as Parser<unknown>
      : Object.assign(constant(true), entry);
    cmds[name] = command(name, p, parser) as CommandParser<Command<unknown, string>>;
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
  parent: CommandsParser<Command<unknown, string>>,
): CommandParser<Command<T, Name>> {
  let parser: CommandParser<Command<T, Name>> = {
    commands: parent.commands,
    path: [name, ...inner.path],
    description: inner.description,
    aliases: inner.aliases,
    parse(input: Input) {
      return parser.inspect(input).result;
    },
    inspect(input: Input = {}): CommandInfo<Command<T, Name>> {
      let config = inner.inspect.call(parser, input);
      let result = config.result.ok
        ? {
          ok: true as const,
          value: { name, config: config.result.value } as Command<T, Name>,
          remainder: { ...input, args: config.result.remainder.args },
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
          progname: [...parent.progname, name],
          args: config.help.args,
          opts: config.help.opts,
          commands: config.help.commands,
        },
      };
    },
    help(input: Input = {}): string {
      return format(parser.inspect(input));
    },
  };
  return parser;
}

function scope(name: string, input: Input): Input {
  let prefix = toSnake(name).toUpperCase() + "_";
  let values = (input.values ?? []).flatMap((v) => {
    if (v.value == null) return [];
    let obj = v.value as Record<string, unknown>;
    if (!(name in obj)) return [];
    return [{ name: v.name, value: obj[name] }];
  });
  let envs = (input.envs ?? []).map((env) => {
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
  return { ...input, values, envs };
}
