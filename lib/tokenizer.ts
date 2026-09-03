import type { AnyToken } from "./tokenize.ts";

export interface TokenInput<T extends AnyToken> extends Iterable<T> {
  claimNext(): Claim<T>;

  claimOne<S extends T>(match: (token: T) => token is S): Claim<S, T>;
  claimOne(match: (token: T) => boolean): Claim<T, T>;

  claimPair(match: (a: T, b: T) => boolean): Claim<T, T>;

  claimAll<S extends T>(match: (token: T) => token is S): Claim<S, T>;
  claimAll(match: (token: T) => boolean): Claim<T, T>;
}

export interface TokenRange {
  readonly start: number;
  readonly end?: number;
}

export interface ViewOptions {
  readonly range: TokenRange;
  readonly through?: number;
}

export class Tokenizer<T extends AnyToken> implements TokenInput<T> {
  readonly tokens: readonly T[];
  readonly claimed: ReadonlySet<number>;

  constructor(
    tokens: readonly T[],
    claimed: ReadonlySet<number> = new Set(),
  ) {
    this.tokens = tokens;
    this.claimed = new Set(claimed);
  }

  claimNext(): Claim<T> {
    return this.claimOne(() => true);
  }

  claimOne<S extends T>(match: (token: T) => token is S): Claim<S, T>;
  claimOne(match: (token: T) => boolean): Claim<T, T>;
  claimOne(match: (token: T) => boolean): Claim<T> {
    for (let token of this) {
      if (match(token)) {
        return {
          tokens: [token],
          rest: remainder(this, [token.index]),
        };
      }
    }
    return { tokens: [], rest: this };
  }

  claimPair(match: (a: T, b: T) => boolean): Claim<T, T> {
    let previous: T | undefined;
    for (let token of this) {
      if (!previous) {
        previous = token;
        continue;
      }
      if (match(previous, token)) {
        return {
          tokens: [previous, token],
          rest: remainder(this, [previous.index, token.index]),
        };
      }
      previous = token;
    }
    return { tokens: [], rest: this };
  }

  claimAll<S extends T>(match: (token: T) => token is S): Claim<S, T>;
  claimAll(match: (token: T) => boolean): Claim<T, T>;
  claimAll(match: (token: T) => boolean): Claim<T> {
    let tokens: T[] = [];
    let claimed = new Set<number>();
    for (let token of this) {
      if (match(token)) {
        claimed.add(token.index);
        tokens.push(token);
      }
    }
    return {
      tokens,
      rest: tokens.length > 0 ? remainder(this, claimed) : this,
    };
  }

  view(options: ViewOptions): TokenInput<T> {
    return new View(this, options);
  }

  *[Symbol.iterator](): Generator<T, void, unknown> {
    for (let token of this.tokens) {
      if (!this.claimed.has(token.index)) {
        yield token;
      }
    }
  }
}

export interface Claim<T extends AnyToken, R extends AnyToken = T> {
  tokens: T[];
  rest: Tokenizer<R>;
}

class View<T extends AnyToken> implements TokenInput<T> {
  constructor(
    readonly source: Tokenizer<T>,
    readonly options: ViewOptions,
  ) {}

  claimNext(): Claim<T> {
    return this.claimOne(() => true);
  }

  claimOne<S extends T>(match: (token: T) => token is S): Claim<S, T>;
  claimOne(match: (token: T) => boolean): Claim<T, T>;
  claimOne(match: (token: T) => boolean): Claim<T> {
    for (let token of this) {
      if (match(token)) {
        return {
          tokens: [token],
          rest: remainder(this.source, [token.index]),
        };
      }
    }
    return { tokens: [], rest: this.source };
  }

  claimPair(match: (a: T, b: T) => boolean): Claim<T, T> {
    let previous: T | undefined;
    for (let token of this) {
      if (!previous) {
        previous = token;
        continue;
      }
      if (match(previous, token)) {
        return {
          tokens: [previous, token],
          rest: remainder(this.source, [previous.index, token.index]),
        };
      }
      previous = token;
    }
    return { tokens: [], rest: this.source };
  }

  claimAll<S extends T>(match: (token: T) => token is S): Claim<S, T>;
  claimAll(match: (token: T) => boolean): Claim<T, T>;
  claimAll(match: (token: T) => boolean): Claim<T> {
    let tokens: T[] = [];
    let claimed = new Set<number>();
    for (let token of this) {
      if (match(token)) {
        claimed.add(token.index);
        tokens.push(token);
      }
    }
    return {
      tokens,
      rest: tokens.length > 0 ? remainder(this.source, claimed) : this.source,
    };
  }

  *[Symbol.iterator](): Generator<T, void, unknown> {
    let { start, end } = this.options.range;
    let { through } = this.options;

    for (let token of this.source) {
      if (
        token.index > start &&
        (end === undefined || token.index < end) &&
        (through === undefined || token.index <= through)
      ) {
        yield token;
      }
    }
  }
}

function remainder<T extends AnyToken>(
  source: Tokenizer<T>,
  claimed: Iterable<number>,
): Tokenizer<T> {
  return new Tokenizer(
    source.tokens,
    new Set([...source.claimed, ...claimed]),
  );
}
