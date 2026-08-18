import { AnyToken } from "./tokenize.ts";

export class Tokenizer implements Iterable<AnyToken> {
  tokens: Iterable<AnyToken>;
  claimed: Set<number>;

  constructor(
    tokens: typeof this.tokens,
    claimed: typeof this.claimed = new Set(),
  ) {
    this.tokens = tokens;
    this.claimed = claimed;
  }

  claim(match: (token: AnyToken) => boolean): Claim {
    let tokens: AnyToken[] = [];
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

  *[Symbol.iterator]() {
    for (let token of this.tokens) {
      if (!this.claimed.has(token.index)) {
        yield token;
      }
    }
  }
}

export interface Claim {
  tokens: AnyToken[];
  rest: Tokenizer;
}
