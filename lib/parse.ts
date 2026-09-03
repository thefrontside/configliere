import { bindPhase } from "./bind.ts";
import type { Symbol } from "./read.ts";
import type { Rest } from "./rest.ts";
import type { Result } from "./result.ts";
import { type AnyToken, type Literal, tokenize } from "./tokenize.ts";
import { Tokenizer } from "./tokenizer.ts";
import { Values } from "./values.ts";
import type {
  AnyIntent,
  AnyPhase,
  AnyPhases,
  AnyRoute,
  Input,
  Issue,
  Method,
  ModelsByRoute,
  Outcome,
  Parse,
  Path,
  RoutePath,
  UnprocessableContent,
} from "./types.ts";

export function parse<const R extends AnyRoute>(
  route: R,
  input: Input,
): Parse<R>;

export function parse(
  route: AnyRoute,
  input: Input,
): unknown {
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

  let rest: Rest = {
    tokens: literals.rest as Tokenizer<Symbol>,
    values: new Values().mount([], input.values ?? []),
  };

  return resume({
    segments: [{
      id: "/",
      route,
      phases: route.phases,
      tokens: Array.from(rest.tokens),
      path: [],
      start: -1,
      model: {},
      issues: [],
      history: [],
    }],
    active: 0,
    rest,
    models: {},
    method,
    literals: literals.tokens,
  });
}
function resume(
  state: ParserState,
): Outcome<AnyIntent | AnyIncrement> {
  while (true) {
    // Starting from the deepest open segment, synchronously descend through
    // routes visible on each segment's head phase.
    state = search(state);

    let index = state.active;
    let segment = state.segments[index];
    let [phase] = segment.phases;

    state = {
      ...state,
      rest: {
        ...state.rest,
        values: state.rest.values.mount(segment.path, phase.values),
      },
    };

    // Controls are free of ordinary configuration validation. A dynamic phase
    // is the exception: its model is needed by the caller before the remaining
    // route graph (and therefore the final control target) can be known.
    if (state.method !== "execute" && !phase.resolver) {
      let models = {
        ...state.models,
        [segment.id]: segment.model,
      };

      if (index + 1 < state.segments.length) {
        state = {
          ...state,
          active: index + 1,
          models,
        };

        continue;
      }

      return resolve({ ...state, models }, segment);
    }

    // Bind only this phase, within this segment's token view.
    //
    // For an open dynamic segment, binding may consume the horizon but may not
    // look beyond it. For a committed segment, `end` is the hard boundary.
    let binding = bindPhase({
      phase,
      segment: {
        range: {
          start: segment.start,
          end: segment.end,
        },
        path: segment.path,
      },
      rest: state.rest,
    });

    segment = {
      ...segment,
      model: {
        ...segment.model,
        ...binding.model,
      },
      issues: [
        ...segment.issues,
        ...binding.issues,
      ],
    };

    state = {
      ...state,
      rest: binding.rest,
      segments: replace(state.segments, index, segment),
    };

    if (!binding.valid) {
      let issues = phase.resolver
        ? binding.issues
        : [...unexpected(state, segment), ...binding.issues];

      return unprocessableContent(
        state.segments[state.segments.length - 1],
        issues,
      );
    }

    if (phase.resolver) {
      // Binding the phase succeeded, but the requirement is still needed.
      let suspended = state;

      return {
        ok: true,
        route: segment.id,
        model: binding.model,

        resume(result) {
          if (!result.ok) {
            return unprocessableContent(segment, result.issues);
          }

          // AnyPhase erases these exact types with `never`; dynamic() already
          // proved them at its public boundary.
          let resolver = phase.resolver as unknown as (
            requirement: unknown,
          ) => (route: AnyRoute) => AnyRoute;

          // The extension operates against the same aggregate route metadata,
          // but begins with one fresh, empty phase.
          let continuation = resolver(result.value)(
            seed(segment.route),
          );
          let phases = stitch(
            continuation.phases,
            segment.phases.slice(1),
          );
          let history = [...segment.history, phase];

          let next: Segment = {
            ...segment,
            route: {
              ...continuation,
              phases: [...history, ...phases] as unknown as AnyPhases,
            },
            phases,
            history,
            issues: [
              ...segment.issues,
              ...(result.issues ?? []),
            ],
          };

          return resume({
            ...suspended,
            segments: replace(suspended.segments, index, next),
          });
        },
      };
    }

    // A phase without a resolver is the final phase of this segment.
    let issues = unexpected(state, segment);

    if (issues.length > 0) {
      return unprocessableContent(
        state.segments[state.segments.length - 1],
        issues,
      );
    }

    let id = `/${segment.path.join("/")}`;
    let models = {
      ...state.models,
      [id]: segment.model,
    };

    // There is already a synchronously matched child segment.
    if (index + 1 < state.segments.length) {
      state = {
        ...state,
        active: index + 1,
        models,
      };

      continue;
    }

    // The deepest selected segment is fully resolved.
    return resolve({
      ...state,
      models,
    }, segment);
  }
}

interface ParserState {
  segments: [Segment, ...Segment[]];
  active: number;
  rest: Rest;
  models: ModelsByRoute;
  method: Method;
  literals: Literal[];
}

interface AnyIncrement {
  readonly ok: true;
  readonly route: RoutePath;
  readonly model: object;
  resume(result: Result<unknown>): Outcome<AnyIntent | AnyIncrement>;
}

interface Segment {
  id: RoutePath;
  route: AnyRoute;
  path: Path;
  phases: AnyPhases;
  tokens: Symbol[];
  start: number;
  end?: number;
  model: Record<string, unknown>;
  issues: Issue[];
  history: AnyPhase[];
}

function search(state: ParserState): ParserState {
  let segments = [...state.segments] as [Segment, ...Segment[]];
  let rest = state.rest;

  while (true) {
    let index = segments.length - 1;
    let segment = segments[index];
    let [phase] = segment.phases;
    let remaining = new Set(Array.from(rest.tokens, (token) => token.index));
    let selector = segment.tokens.find((token) => {
      return remaining.has(token.index) && token.type === "word" &&
        phase.routes.some((route) => route.name === token.text);
    });

    if (!selector) {
      return { ...state, segments, rest };
    }

    let child = phase.routes.find((route) => route.name === selector.text)!;
    let path = [...segment.path, child.name];
    let before = segment.tokens.filter((token) => token.index < selector.index);
    let after = segment.tokens.filter((token) => token.index > selector.index);

    segments[index] = {
      ...segment,
      tokens: before,
      end: selector.index,
    };
    segments.push({
      id: `/${path.join("/")}`,
      route: child,
      path,
      phases: child.phases,
      tokens: after,
      start: selector.index,
      model: {},
      issues: [],
      history: [],
    });

    rest = {
      ...rest,
      tokens: rest.tokens.claimOne((token) => token.index === selector.index)
        .rest,
    };
  }
}

function flags(...texts: string[]): (token: AnyToken) => boolean {
  return (token) => token.type === "flag" && texts.includes(token.text);
}

function stitch(
  before: AnyPhases,
  after: readonly AnyPhase[],
): AnyPhases {
  if (after.length === 0) {
    return before;
  }

  let phases = [...before];
  let phase = phases.pop()!;
  let [next, ...rest] = after;

  phases.push({
    ...phase,
    ...next,
    params: {
      ...phase.params,
      ...next.params,
    },
    routes: [
      ...phase.routes,
      ...next.routes,
    ],
    values: [
      ...phase.values,
      ...next.values,
    ],
  });
  phases.push(...rest);

  return phases as unknown as AnyPhases;
}

function resolve(
  state: ParserState,
  segment: Segment,
): Outcome<AnyIntent> {
  let route = `/${segment.path.join("/")}` as RoutePath;
  let definition = segment.route;

  if (!definition.methods.includes(state.method)) {
    return {
      ok: false,
      code: "method-not-allowed",
      route,
      definition,
      path: segment.path,
      method: state.method,
      allowed: definition.methods,
    };
  }

  let intent = {
    ok: true as const,
    route,
    definition,
    path: segment.path,
    literals: state.literals,
  };

  switch (state.method) {
    case "help":
      return {
        ...intent,
        method: "help",
      };

    case "version":
      return {
        ...intent,
        method: "version",
      };

    case "execute":
      return {
        ...intent,
        method: "execute",
        model: state.models[route],
        models: state.models,
        issues: state.segments.flatMap((segment) => segment.issues),
      };
  }
}

function seed(route: AnyRoute): AnyRoute {
  return {
    ...route,
    phases: [{
      params: {},
      routes: [],
      values: [],
    }],
  };
}

function replace<T>(
  items: readonly [T, ...T[]],
  index: number,
  value: T,
): [T, ...T[]] {
  let result = [...items] as [T, ...T[]];
  result[index] = value;
  return result;
}

function unprocessableContent(
  segment: Segment,
  issues: readonly Issue[],
): UnprocessableContent {
  return {
    ok: false,
    code: "unprocessable-content",
    route: segment.id,
    definition: segment.route,
    path: segment.path,
    issues: [...issues],
  };
}

function unexpected(
  state: ParserState,
  segment: Segment,
): Issue[] {
  let members = new Set(
    segment.tokens.map((token) => token.index),
  );

  return Array.from(state.rest.tokens)
    .filter((token) => members.has(token.index))
    .map((token) => ({
      message: `unexpected ${JSON.stringify(token.text)}`,
    }));
}
