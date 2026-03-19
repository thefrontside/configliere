import type { ConstantInfo, Parser } from "./types.ts";

export function constant<const T>(value: T): Parser<T, ConstantInfo<T>> {
  let parser: Parser<T, ConstantInfo<T>> = {
    path: [],
    parse(input) {
      return parser.inspect(input).result;
    },
    inspect(input = {}): ConstantInfo<T> {
      return {
        type: "constant",
        parser,
        value,
        result: { ok: true, value, remainder: input },
        help: { progname: [], args: [], opts: [], commands: [] },
      };
    },
    help() {
      return "";
    },
  };
  return parser;
}
