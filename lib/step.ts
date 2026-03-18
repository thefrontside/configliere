import type { Done, Fail, HelpInfo, Input, Parser } from "./types.ts";
import { constant } from "./constant.ts";
import { format, merge } from "./help.ts";

const RESUME = Symbol("configliere.resume");

export interface Resumable<D, T> {
  (deps: D): Parser<T>;
  [RESUME]: true;
}

export interface StepParser<V> extends Parser<V> {
  inner: Parser<V>;
}

export function step<D, T, V>(opts: {
  from: (resume: Parser<Resumable<D, T>>) => Parser<V>;
  to: (deps: D) => Parser<T>;
}): StepParser<V> {
  let marker = resumable(opts.to);
  let placeholder = constant(marker);
  let inner = opts.from(placeholder);
  let preview = opts.to(undefined as never);

  return {
    inner,
    path: inner.path,
    description: inner.description,
    aliases: inner.aliases,
    parse(input: Input): Done<V> | Fail {
      let result = inner.parse(input);
      if (!result.ok) return result;

      let value = bake(
        result.value,
        marker as unknown as Resumable<unknown, unknown>,
        result.remainder,
      );

      return {
        ok: true,
        value,
        data: result.data,
        remainder: result.remainder,
      };
    },
    inspect(input: Input = {}): HelpInfo {
      return merge(inner.inspect(input), preview.inspect(input));
    },
    help(input: Input = {}): string {
      return format(this.inspect(input), inner.path.join(".") || "step");
    },
  };
}

// --- internal ---

function resumable<D, T>(fn: (deps: D) => Parser<T>): Resumable<D, T> {
  return Object.assign(fn, { [RESUME]: true as const });
}

function bake<V>(value: V, marker: Resumable<unknown, unknown>, remainder: Input): V {
  if (typeof value === "function" && RESUME in value && value === marker) {
    let wrapped = (deps: unknown) => {
      let parser = (marker as (deps: unknown) => Parser)(deps);
      return withBase(parser, remainder);
    };
    return wrapped as unknown as V;
  }

  if (value && typeof value === "object") {
    let replaced = (Array.isArray(value) ? [...value] : { ...value }) as V;
    for (let key of Object.keys(replaced as object)) {
      let current = (replaced as Record<string, unknown>)[key];
      let baked = bake(current, marker, remainder);
      if (baked !== current) {
        (replaced as Record<string, unknown>)[key] = baked;
      }
    }
    return replaced;
  }

  return value;
}

function withBase<T>(parser: Parser<T>, base: Input): Parser<T> {
  return {
    ...parser,
    parse(enrichment: Input): Done<T> | Fail {
      return parser.parse(mergeInput(base, enrichment));
    },
    inspect(enrichment: Input = {}): HelpInfo {
      return parser.inspect(mergeInput(base, enrichment));
    },
    help(enrichment: Input = {}): string {
      return parser.help(mergeInput(base, enrichment));
    },
  };
}

function mergeInput(base: Input, enrichment: Input): Input {
  return {
    args: base.args ?? [],
    values: [...(base.values ?? []), ...(enrichment.values ?? [])],
    envs: [...(base.envs ?? []), ...(enrichment.envs ?? [])],
  };
}
