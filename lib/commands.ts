import type {
  AvailableInput,
  Command,
  CommandInfo,
  CommandsInfo,
  ParseContext,
  ParseResult,
  Parser,
  Prefix,
  Token,
} from "./types.ts";
import { toEnvCase } from "./case.ts";
import { defineParser } from "./parser.ts";

export type CommandEntry<Name extends string, T> = readonly [Name, Parser<T>];

export interface CommandsParser<T extends Command<unknown, string>>
  extends Parser<T, CommandsInfo<T>> {
  default?: string;
}

export function commands<
  const E extends readonly (readonly [string, Parser<unknown>])[],
>(
  entries: E,
  opts: { default?: string } = {},
): CommandsParser<
  {
    [I in keyof E]: E[I] extends readonly [infer N extends string, Parser<infer V>]
      ? Command<V, N>
      : never;
  }[number]
> {
  type ResultType = Command<unknown, string>;

  let parser = defineParser<ResultType, CommandsInfo<ResultType>>({
    type: "commands",
    claim(ctx) {
      let claims: Token[] = [];
      let dispatch = chooseCommand(ctx, entries, opts.default);
      if (!dispatch) return claims;

      if (dispatch.token) claims.push(dispatch.token);

      let chosen = entries.find(([n]) => n === dispatch.name)!;
      let innerCtx = innerContext(ctx, dispatch.name, dispatch.innerArgs);
      claims.push(...chosen[1].claim(innerCtx));
      return claims;
    },
    parse(ctx, _claims, remainder) {
      let dispatch = chooseCommand(ctx, entries, opts.default);
      let allInfos = gatherMetadata(ctx, entries);

      if (!dispatch) {
        return {
          result: {
            ok: false,
            error: new NoCommandMatchError(entries.map(([n]) => n)),
            remainder,
          },
          commands: allInfos as CommandsInfo<ResultType>["commands"],
          help: {
            progname: ctx.progname,
            args: [],
            opts: [],
            commands: Object.values(allInfos),
          },
        };
      }

      let chosen = entries.find(([n]) => n === dispatch.name)!;
      let innerCtx = innerContext(ctx, dispatch.name, dispatch.innerArgs);
      let innerInfo = chosen[1].inspect(innerCtx);

      let value: Command<unknown, string> = innerInfo.result.ok
        ? { name: dispatch.name, config: innerInfo.result.value } as Command<unknown, string>
        : { name: dispatch.name } as unknown as Command<unknown, string>;

      let result: ParseResult<ResultType> = innerInfo.result.ok
        ? { ok: true, value: value as ResultType, remainder }
        : { ok: false, error: innerInfo.result.error, remainder };

      let commandInfo: CommandInfo<Command<unknown, string>> = {
        type: "command",
        parser: chosen[1] as unknown as Parser<Command<unknown, string>>,
        prefix: innerCtx.prefix,
        claims: [],
        remainder: innerInfo.remainder,
        result: innerInfo.result.ok
          ? { ok: true, value, remainder: innerInfo.remainder }
          : { ok: false, error: innerInfo.result.error, remainder: innerInfo.remainder },
        name: dispatch.name,
        description: chosen[1].description,
        aliases: chosen[1].aliases,
        config: innerInfo,
        commands: {},
        help: innerInfo.help,
      };

      allInfos[dispatch.name] = commandInfo;

      return {
        result,
        commands: allInfos as CommandsInfo<ResultType>["commands"],
        help: {
          progname: ctx.progname,
          args: [],
          opts: [],
          commands: Object.values(allInfos),
        },
      };
    },
  }) as CommandsParser<ResultType>;

  parser.default = opts.default;

  return parser as CommandsParser<{
    [I in keyof E]: E[I] extends readonly [infer N extends string, Parser<infer V>]
      ? Command<V, N>
      : never;
  }[number]>;
}

export class NoCommandMatchError extends Error {
  constructor(public available: string[]) {
    super(`No command matched. Available: ${available.join(", ")}`);
    this.name = "NoCommandMatchError";
  }
}

// --- internal ---

interface Dispatch {
  name: string;
  token: Token | undefined;
  innerArgs: AvailableInput["args"];
}

function chooseCommand(
  ctx: ParseContext,
  entries: readonly (readonly [string, Parser<unknown>])[],
  fallback: string | undefined,
): Dispatch | undefined {
  let { available } = ctx;
  let names = new Set(entries.map(([n]) => n));
  let pos = available.args.findIndex((a) =>
    !a.value.startsWith("-") && names.has(a.value)
  );
  if (pos !== -1) {
    let matched = available.args[pos];
    return {
      name: matched.value,
      token: { type: "arg", from: matched.index, to: matched.index },
      innerArgs: available.args.filter((_, i) => i !== pos),
    };
  }
  if (fallback && names.has(fallback)) {
    return { name: fallback, token: undefined, innerArgs: available.args };
  }
  return undefined;
}

function innerContext(
  ctx: ParseContext,
  name: string,
  innerArgs: AvailableInput["args"],
): ParseContext {
  let prefix: Prefix = {
    values: ctx.prefix.values.concat(name),
    envs: ctx.prefix.envs + toEnvCase(name) + "_",
    args: [],
  };
  return {
    ...ctx,
    prefix,
    available: {
      args: innerArgs,
      values: scopeValues(ctx.available.values, name),
      envs: scopeEnvs(ctx.available.envs, prefix.envs),
    },
  };
}

function gatherMetadata(
  ctx: ParseContext,
  entries: readonly (readonly [string, Parser<unknown>])[],
): Record<string, CommandInfo<Command<unknown, string>>> {
  let infos: Record<string, CommandInfo<Command<unknown, string>>> = {};
  for (let [name, cmd] of entries) {
    let prefix: Prefix = {
      values: ctx.prefix.values.concat(name),
      envs: ctx.prefix.envs + toEnvCase(name) + "_",
      args: [],
    };
    let metaCtx: ParseContext = {
      ...ctx,
      prefix,
      available: {
        args: [],
        values: scopeValues(ctx.available.values, name),
        envs: scopeEnvs(ctx.available.envs, prefix.envs),
      },
    };
    let info = cmd.inspect(metaCtx);
    infos[name] = {
      type: "command",
      parser: cmd as unknown as Parser<Command<unknown, string>>,
      prefix,
      claims: [],
      remainder: info.remainder,
      result: info.result.ok
        ? {
          ok: true,
          value: { name, config: info.result.value } as Command<unknown, string>,
          remainder: info.remainder,
        }
        : { ok: false, error: info.result.error, remainder: info.remainder },
      name,
      description: cmd.description,
      aliases: cmd.aliases,
      config: info,
      commands: {},
      help: info.help,
    };
  }
  return infos;
}

function scopeValues(
  values: AvailableInput["values"],
  name: string,
): AvailableInput["values"] {
  return values.flatMap((entry) => {
    let v = entry.value;
    if (v == null || typeof v !== "object") return [];
    let inner = (v as Record<string, unknown>)[name];
    if (inner === undefined) return [];
    return [{ source: entry.source, value: inner }];
  });
}

function scopeEnvs(
  envs: AvailableInput["envs"],
  prefix: string,
): AvailableInput["envs"] {
  return envs.map((entry) => {
    let scoped: Record<string, string> = {};
    for (let [k, val] of Object.entries(entry.value)) {
      if (k.startsWith(prefix)) {
        scoped[k.slice(prefix.length)] = val;
      } else {
        scoped[k] = val;
      }
    }
    return { source: entry.source, value: scoped };
  });
}
