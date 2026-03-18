import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Input, Parser } from "./types.ts";
import { constant } from "./constant.ts";
import { toSnake } from "ts-case-convert";
import { cli, field } from "./field.ts";
import { object } from "./object.ts";
import { format, inspect } from "./help.ts";
import { string } from "./schema.ts";

export interface Help {
  command: string;
  text: string;
}

export type CommandEntry = Partial<Parser>;

export const help: Parser<Help> = Object.assign(
  {
    path: [] as string[],
    description: "show help for a command",
    parse(input: Input) {
      let cmds: Record<string, CommandParser<unknown, string>> =
        (this as unknown as CommandParser<unknown, string>).commands ?? {};
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

      let result = inner.parse(input);
      if (!result.ok) return result;

      let cmd = cmds[result.value.command];
      let info = inspect(cmd.parser);
      let text = format(info, result.value.command);

      return {
        ok: true as const,
        value: { command: result.value.command, text },
        data: void 0,
        remainder: result.remainder,
      };
    },
  },
  {
    attrs: {
      command: {
        description: "command to show help for",
        ...field(string, cli.argument()),
      },
    },
  },
);

export interface Command<T, Name extends string> {
  name: Name;
  config: T;
}

export interface CommandParser<T, Name extends string>
  extends Parser<Command<T, Name>> {
  name: Name;
  commands: Record<string, CommandParser<unknown, string>>;
  parser: Parser<T>;
}

export interface CommandsParser<V = unknown>
  extends Parser<V> {
  commands: Record<string, CommandParser<unknown, string>>;
  default?: string;
}

export function commands<T extends Record<string, CommandEntry>>(
  map: T,
  opts?: { default?: string },
): CommandsParser<CommandValue<T>> {
  let cmds: Record<string, CommandParser<unknown, string>> = {};
  for (let [name, entry] of Object.entries(map) as [string, CommandEntry][]) {
    let parser = typeof entry.parse === "function"
      ? entry as Parser
      : { ...constant(true), ...entry };
    cmds[name] = command(name, parser, cmds);
  }

  type V = CommandValue<T>;

  return {
    commands: cmds,
    default: opts?.default,
    path: [],
    parse(input: Input) {
      let args = input.args ?? [];

      let [matched, remainder] = match(args, cmds, opts);

      if (!matched) {
        return {
          ok: false as const,
          error: new NoCommandMatchError(Object.keys(cmds)),
          remainder: input,
        };
      }

      return matched.parse(scope(matched.name, { ...input, args: remainder }));
    },
  } as CommandsParser<V>;
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
  cmds: Record<string, CommandParser<unknown, string>>,
  opts?: { default?: string },
): [CommandParser<unknown, string> | undefined, string[]] {
  if (args.length > 0) {
    if (args[0] in cmds) return [cmds[args[0]], args.slice(1)];
    for (let [, cmd] of Object.entries(cmds)) {
      if (cmd.parser.aliases?.includes(args[0])) return [cmd, args.slice(1)];
    }
  }
  if (opts?.default && cmds[opts.default]) return [cmds[opts.default], args];
  return [undefined, args];
}

function command<T, const Name extends string>(
  name: Name,
  parser: Parser<T>,
  cmds: Record<string, CommandParser<unknown, string>>,
): CommandParser<T, Name> {
  return {
    name,
    parser,
    commands: cmds,
    path: [name, ...parser.path],
    parse(input: Input) {
      let result = parser.parse.call(this, input);

      if (result.ok) {
        return {
          ok: true as const,
          value: { name, config: result.value } as Command<T, Name>,
          data: result.data,
          remainder: { ...input, args: result.remainder.args },
        };
      }

      return result;
    },
  };
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

type CommandValue<T extends Record<string, CommandEntry>> =
  & {
    [K in keyof T & string]: T[K] extends
      Parser<infer V> ? { name: K; config: V }
      : { name: K; config: true };
  }
  & {} extends infer U ? U[keyof U & keyof T & string] : never;
