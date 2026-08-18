import { type AnyToken, tokenize } from "./tokenize.ts";
import { Tokenizer } from "./tokenizer.ts";
import type { AnyRoute, Input, Resolve, Result } from "./types.ts";

export function parse<const R extends AnyRoute>(
  route: R,
  input: Input,
): Result<Resolve<R, []>> {
  let tokenizer = new Tokenizer(tokenize(input.argv));
  let help = tokenizer.claim(flags("-h", "--help"));

  if (help.tokens.length > 0) {
    return {
      ok: true,
      type: "help",
      route,
      path: [],
    };
  }

  let version = help.rest.claim(flags("-v", "--version"));
  if (version.tokens.length > 0) {
    if (route.version) {
      return {
        ok: true,
        type: "version",
        route,
        path: [],
      };
    } else {
      // should this be an error?
    }
  }

  return {
    ok: true,
    type: "execute",
    route,
    path: [],
  };
}

function flags(...texts: string[]): (token: AnyToken) => boolean {
  return (token) => token.type === "flag" && texts.includes(token.text);
}
