import type { Input, Parser, ParserInfo } from "./types.ts";
import { format } from "./help.ts";

export function step<T, To extends (...args: never[]) => Parser<unknown>>(
  opts: {
    from: (next: To) => Parser<T>;
    to: To;
  },
): Parser<T> {
  let parser: Parser<T> = {
    progname: [],
    path: [],
    parse(input: Input) {
      return parser.inspect(input).result;
    },
    inspect(input: Input = {}): ParserInfo<T> {
      let remainder = input;
      let next = ((...deps: unknown[]) => {
        let p = opts.to(...deps as never[]);
        p.progname = parser.progname;
        let wrapped = {
          ...p,
          parse(enrichment: Input) {
            return p.parse(concat(remainder, enrichment));
          },
          inspect(enrichment: Input = {}) {
            let phase2 = p.inspect(concat(remainder, enrichment));
            return {
              ...phase2,
              help: {
                progname: parser.progname.length
                  ? parser.progname
                  : info.help.progname.length
                  ? info.help.progname
                  : phase2.help.progname,
                args: [...info.help.args, ...phase2.help.args],
                opts: [...info.help.opts, ...phase2.help.opts],
                commands: [...info.help.commands, ...phase2.help.commands],
              },
            };
          },
          help(enrichment: Input = {}) {
            return format(wrapped.inspect(enrichment));
          },
        };
        return wrapped;
      }) as unknown as To;

      let outer = opts.from(next);
      let info = outer.inspect(input);
      if (info.result.ok) {
        remainder = info.result.remainder;
      }
      return { ...info, parser } as ParserInfo<T>;
    },
    help(input: Input = {}): string {
      return format(parser.inspect(input));
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
