import type { AnyStep, Input, Parser } from "./types.ts";
import { object } from "./object.ts";
import { format, inspect } from "./help.ts";
import { assert } from "@std/assert";

export interface Program<P extends Parser<[AnyStep, ...AnyStep[]]>> {
  name: string;
  version?: string;
  config: P;
  createParser(input: Input): {
    type: "help";
    print(): string;
  } | {
    type: "version";
    print(): string;
  } | {
    type: "main";
    parse(): ReturnType<P["parse"]>;
  };
}

export function program<P extends Parser<[AnyStep, ...AnyStep[]]>>(
  opts: {
    name: string;
    version?: string;
    config: P;
  },
): Program<P> {
  let { name, version, config } = opts;

  return {
    name,
    version,
    config,
    createParser(input: Input): ReturnType<Program<P>["createParser"]> {
      const preamble = object({
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

      let probe = preamble.parse(input);
      assert(probe.ok);

      if (probe.value.help) {
        return { type: "help", print: () => printHelp(name, config, preamble) };
      }
      if ((probe.value as { version?: boolean }).version) {
        return {
          type: "version",
          print: () => version!,
        };
      }

      return {
        type: "main",
        parse: () => config.parse(probe.remainder),
        // deno-lint-ignore no-explicit-any
      } as any;
    },
  };
}

// --- internal ---

function printHelp(
  name: string,
  config: Parser,
  preamble: Parser,
): string {
  let info = inspect(config);
  let extra = inspect(preamble);

  for (let opt of extra.opts) {
    info.opts.push(opt);
  }

  return format(info, name);
}
