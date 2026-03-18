import type { HelpInfo, Input, Parser } from "./types.ts";
import { object } from "./object.ts";
import { format, merge } from "./help.ts";
import assert from "node:assert";

export type Program<T> =
  | { type: "help"; text: string }
  | { type: "version"; text: string }
  | { type: "main"; parser: Parser<T> };

export function program<T>(
  opts: {
    name: string;
    version?: string;
    config: Parser<T>;
  },
): Parser<Program<T>> {
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
  });

  return {
    path: [],
    parse(input: Input) {
      let probe = preamble.parse(input);
      assert(probe.ok);

      if (probe.value.help) {
        return {
          ok: true as const,
          value: { type: "help" as const, text: printHelp(name, config, preamble, input) },
          data: probe.data,
          remainder: probe.remainder,
        };
      }

      if ((probe.value as { version?: boolean }).version) {
        return {
          ok: true as const,
          value: { type: "version" as const, text: version! },
          data: probe.data,
          remainder: probe.remainder,
        };
      }

      let remainder = probe.remainder;

      return {
        ok: true as const,
        value: {
          type: "main" as const,
          parser: withBase(config, remainder),
        },
        data: probe.data,
        remainder,
      };
    },
    inspect(input: Input = {}): HelpInfo {
      return merge(config.inspect(input), preamble.inspect(input));
    },
    help(input: Input = {}): string {
      return format(this.inspect(input), name);
    },
  };
}

// --- internal ---

function withBase<T>(parser: Parser<T>, base: Input): Parser<T> {
  return {
    ...parser,
    parse(enrichment: Input) {
      return parser.parse(mergeInput(base, enrichment));
    },
    inspect(enrichment: Input = {}): HelpInfo {
      return parser.inspect(mergeInput(base, enrichment));
    },
    help(enrichment: Input = {}): string {
      return parser.help(mergeInput(base, enrichment));
    },
  };
}

function mergeInput(base: Input, enrichment: Input): Input {
  return {
    args: base.args ?? [],
    values: [...(base.values ?? []), ...(enrichment.values ?? [])],
    envs: [...(base.envs ?? []), ...(enrichment.envs ?? [])],
  };
}

function printHelp(
  name: string,
  config: Parser,
  preamble: Parser,
  input: Input,
): string {
  return format(merge(config.inspect(input), preamble.inspect(input)), name);
}
