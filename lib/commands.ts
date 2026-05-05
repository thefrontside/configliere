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
import { createContext } from "./context.ts";
import { format } from "./help.ts";
import { toEnvCase } from "./case.ts";

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

  let parser: CommandsParser<ResultType> = {
    default: opts.default,
    parse(input, ctx) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    inspect(ctx: ParseContext): CommandsInfo<ResultType> {
      let { available } = ctx;

      let nameSet = new Set(entries.map(([n]) => n));
      let matchPos = available.args.findIndex((a) =>
        !a.value.startsWith("-") && nameSet.has(a.value)
      );
      let chosenName: string | undefined;
      let claims: Token[] = [];
      let innerAvailable: AvailableInput;

      if (matchPos !== -1) {
        let matched = available.args[matchPos];
        chosenName = matched.value;
        claims.push({ type: "arg", from: matched.index, to: matched.index });
        innerAvailable = {
          ...available,
          args: available.args.filter((_, i) => i !== matchPos),
        };
      } else if (opts.default && nameSet.has(opts.default)) {
        chosenName = opts.default;
        innerAvailable = available;
      } else {
        let remainder = available;
        return {
          type: "commands",
          parser,
          prefix: ctx.prefix,
          claims: [],
          remainder,
          result: {
            ok: false,
            error: new NoCommandMatchError([...nameSet]),
            remainder,
          },
          commands: {},
          help: { progname: ctx.progname, args: [], opts: [], commands: [] },
        } as unknown as CommandsInfo<ResultType>;
      }

      let chosen = entries.find(([n]) => n === chosenName)!;
      let innerPrefix: Prefix = {
        values: ctx.prefix.values.concat(chosenName),
        envs: ctx.prefix.envs + toEnvCase(chosenName) + "_",
        args: [],
      };

      let scopedValues = innerAvailable.values.flatMap((entry) => {
        let v = entry.value;
        if (v == null || typeof v !== "object") return [];
        let inner = (v as Record<string, unknown>)[chosenName!];
        if (inner === undefined) return [];
        return [{ source: entry.source, value: inner }];
      });
      let scopedEnvs = innerAvailable.envs.map((entry) => {
        let scoped: Record<string, string> = {};
        let p = innerPrefix.envs;
        for (let [k, val] of Object.entries(entry.value)) {
          if (k.startsWith(p)) {
            scoped[k.slice(p.length)] = val;
          } else {
            scoped[k] = val;
          }
        }
        return { source: entry.source, value: scoped };
      });

      let innerCtx: ParseContext = {
        ...ctx,
        prefix: innerPrefix,
        available: { args: innerAvailable.args, values: scopedValues, envs: scopedEnvs },
      };
      let innerInfo = chosen[1].inspect(innerCtx);

      let resultValue: Command<unknown, string> = innerInfo.result.ok
        ? { name: chosenName, config: innerInfo.result.value } as Command<unknown, string>
        : { name: chosenName } as unknown as Command<unknown, string>;

      let result: ParseResult<ResultType> = innerInfo.result.ok
        ? { ok: true, value: resultValue as ResultType, remainder: innerInfo.remainder }
        : { ok: false, error: innerInfo.result.error, remainder: innerInfo.remainder };

      let commandInfo: CommandInfo<Command<unknown, string>> = {
        type: "command",
        parser: chosen[1] as unknown as Parser<Command<unknown, string>>,
        prefix: innerPrefix,
        claims: [],
        remainder: innerInfo.remainder,
        result: innerInfo.result.ok
          ? { ok: true, value: resultValue, remainder: innerInfo.remainder }
          : { ok: false, error: innerInfo.result.error, remainder: innerInfo.remainder },
        name: chosenName,
        description: chosen[1].description,
        aliases: chosen[1].aliases,
        config: innerInfo,
        commands: {},
        help: innerInfo.help,
      };

      let allCommandInfos: Record<string, CommandInfo<Command<unknown, string>>> = {
        [chosenName]: commandInfo,
      };

      return {
        type: "commands",
        parser,
        prefix: ctx.prefix,
        claims,
        remainder: innerInfo.remainder,
        result,
        commands: allCommandInfos as CommandsInfo<ResultType>["commands"],
        help: innerInfo.help,
      } as unknown as CommandsInfo<ResultType>;
    },
    help(input, ctx) {
      return format(parser.inspect(ctx ?? createContext(input)));
    },
  } as CommandsParser<ResultType>;

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
