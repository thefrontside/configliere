import { bind } from "./bind.ts";
import {
  type AnyToken,
  type Flag,
  type Literal,
  type Setter,
  tokenize,
  type Word,
} from "./tokenize.ts";
import { Tokenizer } from "./tokenizer.ts";
import type {
  AnyResolve,
  AnyRoute,
  Input,
  Issue,
  Method,
  Parse,
  Path,
  Resolve,
  RoutePath,
} from "./types.ts";

export function parse<const R extends AnyRoute>(
  route: R,
  input: Input,
): Parse<Resolve<R>>;

export function parse(
  route: AnyRoute,
  input: Input,
): Parse<AnyResolve> {
  let tokenizer = new Tokenizer(tokenize(input.argv));
  let help = tokenizer.claimAll(flags("-h", "--help"));
  let version = help.rest.claimAll(flags("-v", "--version"));
  let escape = version.rest.claimAll((t) => t.type === "separator");
  let literals = escape.rest.claimAll((t) => t.type === "literal");

  let method: Method = "execute";

  if (help.tokens.length > 0) {
    method = "help";
  } else if (version.tokens.length > 0) {
    method = "version";
  }

  let segments = search({ route, tokenizer: literals.rest, path: [] });
  let [match] = segments;
  
  if (match.route.methods.includes(method)) {
    if (method !== "execute") {
      return {
        ok: true,
        method: method,
        route: match.id,
        definition: match.route,
        path: match.path,
        literals: literals.tokens as Iterable<Literal>,
      };
    }

    let models: Record<string, object> = {};
    let issues: Issue[] = [];
    let valid = true;

    for (let segment of segments) {
      let result = model(segment);
      let path = segment.path.length === 0 ? "/" : `/${segment.path.join("/")}`;

      models[path] = result.config;
      issues.push(...result.issues);
      valid &&= result.valid;
    }

    if (!valid) {
      return {
        ok: false,
        code: "unprocessable-content",
        route: match.route,
        path: match.path,
        issues,
      };
    }



    return {
      ok: true,
      method,
      route: match.id,
      model: models[match.id],
      models: models,
      definition: match.route,
      path: match.path,
      literals: literals.tokens,
      issues,
    };
  } else {
    return {
      ok: false,
      code: "method-not-allowed",
      route: match.route,
      path: match.path,
      method: method,
      allowed: match.route.methods,
    };
  }
}

function flags(...texts: string[]): (token: AnyToken) => boolean {
  return (token) => token.type === "flag" && texts.includes(token.text);
}

interface SearchOptions {
  route: AnyRoute;
  tokenizer: Tokenizer<AnyToken>;
  path: Path;
}

interface Segment {
  route: AnyRoute;
  path: Path;
  id: RoutePath;
  tokens: Array<Flag | Word | Setter>;
}

function search(options: SearchOptions): [Segment, ...Segment[]] {
  const { route, tokenizer } = options;
  const segment: Segment = {
    route,
    id: `/${options.path.join("/")}`,
    path: options.path,
    tokens: [],
  };

  let claim = tokenizer.claimNext();

  while (claim.tokens.length > 0) {
    let [token] = claim.tokens;
    if (token.type === "flag" || token.type === "setter") {
      segment.tokens.push(token);
    } else if (token.type === "word") {
      const { text } = token;
      const child = route.children.find((child) => child.name === text);
      if (child) {
        return [
          ...search({
            route: child,
            tokenizer: claim.rest,
            path: options.path.concat(child.name),
          }),
          segment,
        ];
      } else {
        segment.tokens.push(token);
      }
    } else {
      throw new TypeError(`unexpected token ${JSON.stringify(token)}`);
    }

    claim = claim.rest.claimNext();
  }
  return [segment];
}

interface Model {
  config: Record<string, unknown>;
  issues: Issue[];
  valid: boolean;
}

function model(segment: Segment): Model {
  let tokens = new Tokenizer(segment.tokens);
  let config: Record<string, unknown> = {};
  let issues: Issue[] = [];
  let valid = true;

  for (let param of Object.values(segment.route.params)) {
    let binding = bind({ param, tokens });

    tokens = binding.rest;
    issues.push(...binding.result.issues);

    if (!binding.result.ok) {
      valid = false;
    } else if (binding.result.value.exists) {
      config[param.name] = binding.result.value.value;
    }
  }

  for (let token of tokens) {
    valid = false;
    issues.push({
      message: `unexpected ${JSON.stringify(token.text)}`,
    });
  }

  return { config, issues, valid };
}
