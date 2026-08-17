import { type AnyToken, tokenize } from "./tokenize.ts";
import { Tokenizer } from "./tokenizer.ts";
import type { Input, Resolve, Result, Route } from "./types.ts";

export function parse<const R extends Route<string, object>>(
  route: R,
  input: Input,
): Result<Resolve<R, []>> {
  let tokenizer = new Tokenizer(tokenize(input.argv));
  let help = tokenizer.claim(flags("-h", "--help"));

  help.rest.claim(flags("-v", "--version"));

  let type: Resolve<R,[]>["type"] = help.tokens.length > 0 ? "help" : "execute";
  return {
    ok: true,
    type,
    route,
    path: [],
  }
}


function flags(...texts: string[]): (token: AnyToken) => boolean {
  return (token) => token.type === "flag" && texts.includes(token.text);
}

