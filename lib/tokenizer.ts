import type { AnyToken } from "./tokenize.ts";

export class Tokenizer<T extends AnyToken> implements Iterable<T> {
  tokens: Iterable<T>;
  claimed: Set<number>;

  constructor(
    tokens: typeof this.tokens,
    claimed: typeof this.claimed = new Set(),
  ) {
    this.tokens = tokens;
    this.claimed = claimed;
  }

  claimNext(): Claim<T> {
    return this.claimOne<T>(() => true);
  }

  claimOne<S extends T>(match: (token: T) => token is S): Claim<S, T>;
  claimOne<S extends T>(match: (token: T) => boolean): Claim<T, T>;
  claimOne(match: (token: T) => boolean): Claim<T> {
    for (let token of this) {
      if (match(token)) {
        return {
          tokens: [token],
          rest: new Tokenizer(this, new Set([token.index])),
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
          rest: new Tokenizer(this, new Set([previous.index, token.index])),
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
    let claims = new Set<number>();
    for (let token of this) {
      if (match(token)) {
        claims.add(token.index);
        tokens.push(token);
      }
    }
    let rest = new Tokenizer(this, claims);
    return { tokens, rest };
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
