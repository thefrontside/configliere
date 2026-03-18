import type { Input, Parser, ParserInfo } from "./types.ts";
import { format, merge } from "./help.ts";

export function step<T, To extends (...args: never[]) => Parser<unknown>>(
  opts: {
    from: (next: To) => Parser<T>;
    to: To;
  },
): Parser<T> {
  return {
    path: [],
    parse(input: Input) {
      let ref: Input = {};
      let next = ((...deps: unknown[]) => {
        let parser = opts.to(...deps as never[]);
        return {
          ...parser,
          parse(enrichment: Input) {
            return parser.parse(concat(ref, enrichment));
          },
          inspect(enrichment: Input = {}) {
            return parser.inspect(concat(ref, enrichment));
          },
          help(enrichment: Input = {}) {
            return parser.help(concat(ref, enrichment));
          },
        };
      }) as unknown as To;

      let result = opts.from(next).parse(input);
      if (result.ok) {
        ref = result.remainder;
      }
      return result;
    },
    inspect(input: Input = {}): ParserInfo {
      let inner = opts.from(opts.to);
      let to = opts.to(undefined as never);
      return merge(inner.inspect(input), to.inspect(input));
    },
    help(input: Input = {}): string {
      return format(this.inspect(input), this.path.join("."));
    },
  };
}

// --- internal ---

function concat(base: Input, enrichment: Input): Input {
  return {
    args: base.args ?? [],
    values: [...(base.values ?? []), ...(enrichment.values ?? [])],
    envs: [...(base.envs ?? []), ...(enrichment.envs ?? [])],
  };
}
