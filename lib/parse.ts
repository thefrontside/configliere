import { type AnyToken, tokenize } from "./tokenize.ts";
import { Tokenizer } from "./tokenizer.ts";
import type { AnyRoute, Input, Path, Resolve, Result } from "./types.ts";

export function parse<const R extends AnyRoute>(
  route: R,
  input: Input,
): Result<Resolve<R, Path>>;

export function parse(
  route: AnyRoute,
  input: Input,
): Result<Resolve<AnyRoute, Path>> {
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
    if (route.methods.includes("version")) {
      return {
        ok: true,
        type: "version",
        route,
        path: [],
      };
    } else {
      return {
        ok: false,
        code: "method-not-allowed",
        route,
        path: [],
        method: "version",
        allowed: route.methods,

      };
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
