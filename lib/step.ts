import type { Input, Parser, ParserInfo } from "./types.ts";
import { format } from "./help.ts";

export function step<T, To extends (...args: never[]) => Parser<unknown>>(
  opts: {
    from: (next: To) => Parser<T>;
    to: To;
  },
): Parser<T> {
  let parser: Parser<T> = {
    path: [],
    parse(input: Input) {
      return parser.inspect(input).result;
    },
    inspect(input: Input = {}): ParserInfo<T> {
      let remainder = input;
      let next = ((...deps: unknown[]) => {
        let p = opts.to(...deps as never[]);
        return {
          ...p,
          parse(enrichment: Input) {
            return p.parse(concat(remainder, enrichment));
          },
          inspect(enrichment: Input = {}) {
            return p.inspect(concat(remainder, enrichment));
          },
          help(enrichment: Input = {}) {
            return p.help(concat(remainder, enrichment));
          },
        };
      }) as unknown as To;

      let outer = opts.from(next);
      let info = outer.inspect(input);
      if (info.result.ok) {
        remainder = info.result.remainder;
      }
      return { ...info, parser } as ParserInfo<T>;
    },
    help(input: Input = {}): string {
      return format(parser.inspect(input), parser.path.join("."));
    },
  };
  return parser;
}

// --- internal ---

function concat(base: Input, enrichment: Input): Input {
  return {
    args: base.args ?? [],
    values: [...(base.values ?? []), ...(enrichment.values ?? [])],
    envs: [...(base.envs ?? []), ...(enrichment.envs ?? [])],
  };
}
