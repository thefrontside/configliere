import type {
  AvailableInput,
  Input,
  ParseContext,
  Parser,
  ParserInfo,
  Token,
} from "./types.ts";
import { createContext } from "./context.ts";
import { subtract } from "./available.ts";
import { format } from "./help.ts";

export interface ParserSpec<T, I extends ParserInfo<T>> {
  type: string;
  description?: string;
  aliases?: string[];
  claim: (ctx: ParseContext) => Token[];
  parse: (
    ctx: ParseContext,
    claims: Token[],
    remainder: AvailableInput,
  ) => Omit<I, "type" | "parser" | "prefix" | "claims" | "remainder">;
}

export function defineParser<T, I extends ParserInfo<T>>(
  spec: ParserSpec<T, I>,
): Parser<T, I> {
  let parser: Parser<T, I> = {
    description: spec.description,
    aliases: spec.aliases,
    parse(input?: Input, ctx?: ParseContext) {
      return parser.inspect(ctx ?? createContext(input)).result;
    },
    claim(ctx: ParseContext): Token[] {
      return spec.claim(ctx);
    },
    inspect(ctx: ParseContext): I {
      let claims = spec.claim(ctx);
      let remainder = subtract(ctx.available, claims);
      let extras = spec.parse(ctx, claims, remainder);
      return {
        ...extras,
        type: spec.type,
        parser,
        prefix: ctx.prefix,
        claims,
        remainder,
      } as unknown as I;
    },
    help(input?: Input, ctx?: ParseContext): string {
      let info = parser.inspect(ctx ?? createContext(input));
      return format(info, info.prefix.args.join("."));
    },
  };
  return parser;
}
